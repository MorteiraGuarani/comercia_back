import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { posix } from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { parseHTML } from "linkedom";
import { act, createElement } from "react";

// DOM en Node, sin navegador ni conexión a servicios externos.
const { window, document } = parseHTML(
  '<html><body><div id="app"></div></body></html>',
);
Object.assign(globalThis, {
  window,
  document,
  HTMLElement: window.HTMLElement,
  Element: window.Element,
  IS_REACT_ACT_ENVIRONMENT: true,
});
document.oninput = null;
window.location = { search: "" };
window.HTMLElement.prototype.focus = function () {};
const require = createRequire(import.meta.url);
const { createRoot } = require("react-dom/client");
class ApiError extends Error {}
const consultas = [];
const altas = [];
const ediciones = [];
let errorCarga = true;
let rechazarAlta;
let items = [];
const cliente = {
  id: "00001",
  nombre: "Almacén Central",
  direccion: "Calle 123",
  latitud: null,
  longitud: null,
  radioMetros: 100,
  zonaHoraria: "America/Asuncion",
  ruc: "80012345-6",
  address: "",
  street: "Calle 123",
};
async function apiFetch(url, opciones = {}) {
  if (opciones.method === "PUT") {
    ediciones.push({ url, cuerpo: JSON.parse(opciones.body) });
    return { ...cliente, nombre: "Almacén Norte" };
  }
  if (opciones.method === "POST") {
    altas.push(JSON.parse(opciones.body));
    if (altas.length === 1)
      return new Promise((_, reject) => {
        rechazarAlta = reject;
      });
    items = [cliente];
    return cliente;
  }
  consultas.push(url);
  if (errorCarga) throw new ApiError("No tenés acceso a PDV y rutas");
  return { items, total: items.length, page: 1, limit: 7, totalPages: 1 };
}
const stubs = {
  "@/lib/api": { apiFetch, ApiError },
  "next/dynamic": { default: () => () => null, __esModule: true },
  "@/components/toast/toast-controller": { mostrarToast: () => {} },
  "./horarios-local": { HorariosLocal: () => null },
  "./asignaciones-local": { AsignacionesLocal: () => null },
  "@/components/panel/contexto": {
    usePanel: () => ({ usuario: { rol: { equipoCampo: { nombre: "Repositores" } } } }),
  },
  "./tarjeta-pdv": { TarjetaPdv: () => null },
  "./ui/foto-local": { FotoLocal: () => null },
};
const aliases = {
  "@/hooks/use-lista-campo": "hooks/use-lista-campo.ts",
  "@/hooks/use-destino-portal": "hooks/use-destino-portal.ts",
  "@/components/modal": "components/modal.tsx",
  "@/components/pantalla-carga": "components/pantalla-carga.tsx",
  "@/components/icono-mas": "components/icono-mas.tsx",
  "@/components/boton-editar": "components/boton-editar.tsx",
  "@/components/paginacion": "components/paginacion.tsx",
  "./tokens": "components/campo/tokens.ts",
  "./cliente-modal": "components/campo/cliente-modal.tsx",
  "./ui/top-bar": "components/campo/ui/top-bar.tsx",
  "./ui/filtros-catalogo": "components/campo/ui/filtros-catalogo.tsx",
  "./ui/iconos-campo": "components/campo/ui/iconos-campo.tsx",
  "./tarjeta-pdv": "components/campo/tarjeta-pdv.tsx",
  "./ui/foto-local": "components/campo/ui/foto-local.tsx",
};
const cache = new Map();
function cargar(ruta) {
  if (cache.has(ruta)) return cache.get(ruta).exports;
  const modulo = { exports: {} };
  cache.set(ruta, modulo);
  const js = ts.transpileModule(
    readFileSync(new URL(`../src/${ruta}`, import.meta.url), "utf8"),
    {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
      },
    },
  ).outputText;
  const importar = (nombre) => {
    if (stubs[nombre]) return stubs[nombre];
    if (aliases[nombre]) return cargar(aliases[nombre]);
    if (nombre.startsWith("@/") || nombre.startsWith(".")) {
      const base = nombre.startsWith("@/")
        ? nombre.slice(2)
        : posix.join(posix.dirname(ruta), nombre);
      return cargar(
        base +
          (existsSync(new URL(`../src/${base}.tsx`, import.meta.url))
            ? ".tsx"
            : ".ts"),
      );
    }
    return require(nombre);
  };
  vm.runInNewContext(
    js,
    {
      module: modulo,
      exports: modulo.exports,
      require: importar,
      window,
      document,
      Error,
      URLSearchParams,
      AbortController,
      setTimeout,
      clearTimeout,
    },
    { filename: ruta },
  );
  return modulo.exports;
}
const { LocalesPanel } = cargar("components/campo/locales-panel.tsx");
const root = createRoot(document.getElementById("app"));
const click = (boton) =>
  boton.dispatchEvent(new window.Event("click", { bubbles: true }));
const ingresar = (nombre, valor) => {
  const input = document.querySelector(`input[name="${nombre}"]`);
  Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  ).set.call(input, valor);
  input.dispatchEvent(new window.Event("input", { bubbles: true }));
};
const enviar = () =>
  document
    .querySelector("form")
    .dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true }),
    );
try {
  await act(async () => root.render(createElement(LocalesPanel)));
  assert.match(
    document.querySelector('[role="alert"]').textContent,
    /No tenés acceso/,
  );
  assert.doesNotMatch(
    document.body.textContent,
    /No se encontraron clientes|0 clientes/,
  );
  errorCarga = false;
  await act(async () =>
    click(
      Array.from(document.querySelectorAll("button")).find(
        (b) => b.textContent === "Reintentar",
      ),
    ),
  );
  assert.match(document.body.textContent, /No se encontraron clientes/);
  assert.equal(
    document.querySelector('nav[aria-label="Paginación"]'),
    null,
    "El listado vacío no muestra controles de paginación",
  );
  assert.equal(
    document.querySelector("input").getAttribute("placeholder"),
    "Buscar por nombre o código de cliente…",
  );
  assert.doesNotMatch(
    document.body.textContent,
    /OCRD|CardCode|U_Latitud|U_Longitud/,
  );

  await act(async () =>
    click(document.querySelector('[aria-label="Crear cliente"]')),
  );
  assert.ok(document.querySelector('[role="dialog"]'));
  await act(async () => ingresar("Phone1", "0991 18"));
  assert.match(
    document.getElementById("telefono-pista").textContent,
    /Faltan dígitos/,
  );
  await act(async () => {
    ingresar("CardCode", "00001");
    ingresar("CardName", "Almacén Central");
    ingresar("LicTradNum", "80012345-6");
    ingresar("Phone1", "0991188620");
    ingresar("Street", "Calle 123");
  });
  assert.equal(document.querySelector('button[type="submit"]').disabled, false);
  assert.equal(
    document.querySelector('[aria-label="Dígito verificador"]').textContent,
    "-0",
    "Calcula el DV del RUC y reemplaza el que escribieron",
  );
  assert.equal(
    document.querySelector('input[name="Phone1"]').value,
    "+595 991 188620",
    "Formatea el teléfono con el código de Paraguay",
  );
  assert.equal(document.querySelector('button[type="submit"]').textContent, "Siguiente");
  await act(async () => {
    enviar();
    enviar();
  });
  assert.equal(altas.length, 1, "Bloquea envíos duplicados");
  assert.ok(
    document.querySelector('[aria-busy="true"]'),
    "Muestra la carga durante el alta",
  );
  await act(async () =>
    rechazarAlta(
      new ApiError("Ya existe un cliente con ese código en tu empresa"),
    ),
  );
  assert.match(
    document.querySelector('[role="alert"]').textContent,
    /Ya existe un cliente/,
  );
  assert.equal(
    document.querySelector('input[name="CardName"]').value,
    "Almacén Central",
    "Conserva el formulario ante un error",
  );

  await act(async () => enviar());
  assert.deepEqual(altas.at(-1), {
    CardCode: "00001",
    CardName: "Almacén Central",
    LicTradNum: "80012345-0",
    Phone1: "+595991188620",
    Address: "",
    Street: "Calle 123",
  }, "Sin punto marcado no envía coordenadas");
  assert.ok(document.querySelector('[role="dialog"]'), "Sigue abierto para cargar horarios y personal");
  assert.equal(
    document.querySelector('[role="tab"][aria-selected="true"]').textContent,
    "Horarios",
  );
  assert.ok(consultas.at(-1).includes("buscar=00001"));
  assert.match(document.querySelector("table").textContent, /Almacén Central/);
  assert.match(document.querySelector('nav[aria-label="Paginación"]').textContent, /1–1/);

  await act(async () =>
    click(
      Array.from(document.querySelectorAll('[role="tab"]')).find(
        (b) => b.textContent === "Datos y ubicación",
      ),
    ),
  );
  assert.ok(
    Array.from(document.querySelector('input[name="CardCode"]').attributes).some(
      (atributo) => atributo.name.toLowerCase() === "readonly",
    ),
    "El código de cliente no se edita",
  );
  await act(async () => ingresar("CardName", "Almacén Norte"));
  // Antes se perdía: cambiar de pestaña con datos editados ahora los guarda.
  await act(async () =>
    click(
      Array.from(document.querySelectorAll('[role="tab"]')).find(
        (b) => b.textContent === "Horarios",
      ),
    ),
  );
  assert.equal(ediciones.length, 1, "Guarda los datos al cambiar de pestaña");
  assert.equal(
    document.querySelector('[role="tab"][aria-selected="true"]').textContent,
    "Horarios",
  );
  assert.equal(ediciones[0].url, "/campo/locales/00001");
  assert.equal(ediciones[0].cuerpo.CardName, "Almacén Norte");
  assert.equal(ediciones[0].cuerpo.CardCode, undefined, "La edición no manda el código");
  console.log(
    "OK: alta y edición del cliente, reintento sin perder datos, protección contra doble envío y textos en español; sin navegador",
  );
} finally {
  await act(async () => root.unmount());
}
