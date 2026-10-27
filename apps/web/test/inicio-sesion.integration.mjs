import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as jsx from "react/jsx-runtime";

// Ejecuta el formulario real con API y navegación simuladas, sin navegador ni red.
function cargar(ruta, dependencias) {
  const codigo = ts.transpileModule(
    readFileSync(new URL(ruta, import.meta.url), "utf8"),
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } },
  ).outputText;
  const modulo = { exports: {} };
  vm.runInNewContext(codigo, {
    module: modulo, exports: modulo.exports,
    require: (nombre) => {
      assert.ok(nombre in dependencias, `Dependencia sin simular: ${nombre}`);
      return dependencias[nombre];
    },
  });
  return modulo.exports;
}

const menu = cargar("../src/utils/nombres-menu.ts", {});
const campo = [{ ruta: "mi-jornada", paginas: [{ ruta: "locales" }, { ruta: "tareas" }] }];

async function ingresar(equipoCampo, modulos, { falloMenu = false, falloLogin = false } = {}) {
  const destinos = [];
  const peticiones = [];
  class ApiError extends Error {}
  const { LoginForm } = cargar("../src/components/login-form.tsx", {
    "react/jsx-runtime": jsx,
    react: { useState: (valor) => [valor, () => {}] },
    "next/navigation": { useRouter: () => ({ push: (ruta) => destinos.push(ruta) }) },
    "@/components/pantalla-carga": { PantallaCarga: () => null },
    "@/components/ui": { inputBase: "", labelBase: "" },
    "@/utils/nombres-menu": menu,
    "@/lib/api": {
      ApiError,
      apiFetch: async (ruta) => {
        peticiones.push(ruta);
        if (ruta === "/auth/login") {
          if (falloLogin) throw new ApiError("Credenciales incorrectas");
          return { usuario: { rol: equipoCampo ? { descripcion: "Rol personalizado", equipoCampo } : null } };
        }
        assert.equal(ruta, "/mi-plataforma");
        if (falloMenu) throw new Error("Sin conexión");
        return { modulos };
      },
    },
  });
  const encontrarFormulario = (nodo) => {
    if (!nodo || typeof nodo !== "object") return null;
    if (nodo.type === "form") return nodo;
    const hijos = nodo.props?.children;
    for (const hijo of Array.isArray(hijos) ? hijos : [hijos]) {
      const formulario = encontrarFormulario(hijo);
      if (formulario) return formulario;
    }
    return null;
  };
  const formulario = encontrarFormulario(LoginForm());
  assert.ok(formulario);
  await formulario.props.onSubmit({ preventDefault() {} });
  return { destinos, peticiones };
}

assert.deepEqual((await ingresar({ tipo: "REPOSITOR", activo: true }, campo)).destinos, ["/panel"]);
assert.deepEqual((await ingresar({ tipo: "REPOSITOR", activo: true }, [{ ruta: "mi-jornada", paginas: [{ ruta: "tareas" }] }])).destinos, ["/panel"]);
assert.deepEqual((await ingresar({ tipo: "IMPULSADOR", activo: true }, campo)).destinos, ["/panel/mi-jornada/locales"]);
assert.deepEqual((await ingresar({ tipo: "IMPULSADOR", activo: true }, [...campo, { ruta: "gestion-campo", paginas: [] }])).destinos, ["/panel"]);
assert.deepEqual((await ingresar(null, [])).destinos, ["/panel"]);
assert.deepEqual((await ingresar({ tipo: "REPOSITOR", activo: true }, campo, { falloMenu: true })).destinos, ["/panel"]);
const rechazado = await ingresar({ tipo: "REPOSITOR", activo: true }, campo, { falloLogin: true });
assert.deepEqual(rechazado.destinos, []);
assert.deepEqual(rechazado.peticiones, ["/auth/login"]);
console.log("OK: el repositor ingresa a Inicio; impulsador, líder y errores de autenticación conservan su navegación.");
