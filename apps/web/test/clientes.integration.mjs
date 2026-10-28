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
let items = [];
let usuarioPanel = { rol: { equipoCampo: { nombre: "Repositores" } } };
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
  "./horarios-local": { HorariosLocal: () => createElement("section", { "aria-label": "Editor de horarios" }, "Horarios") },
  "./asignaciones-local": { AsignacionesLocal: () => createElement("section", { "aria-label": "Editor de asignación" }, "Personal") },
  "@/components/panel/contexto": {
    usePanel: () => ({ usuario: usuarioPanel }),
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
// El DOM de prueba no trae validación nativa de formularios.
window.HTMLInputElement.prototype.setCustomValidity ??= () => {};
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
    "Buscar local o código",
  );
  assert.doesNotMatch(
    document.body.textContent,
    /OCRD|CardCode|U_Latitud|U_Longitud/,
  );

  assert.equal(document.querySelector('[aria-label="Crear cliente"]').disabled, true);
  await act(async () => click(document.querySelector('[aria-label="Crear cliente"]')));
  assert.equal(document.querySelector('[role="dialog"]'), null);
  assert.equal(altas.length, 0, "El botón de alta deshabilitado no abre ni envía datos");

  items = [cliente];
  await act(async () => root.render(createElement(LocalesPanel, { key: "con-datos" })));
  assert.match(document.body.textContent, /Administración/);
  assert.match(document.querySelector('nav[aria-label="Paginación"]').textContent, /1–1/);
  await act(async () => click(document.querySelector('[aria-label="Información de Almacén Central"]')));
  assert.ok(document.querySelector('[role="dialog"]'));
  assert.equal(document.querySelector('[role="tablist"]'), null, "Información no permite saltar a otras secciones");
  assert.equal(document.querySelector('[aria-label="Editor de horarios"]'), null);
  assert.equal(document.querySelector('[aria-label="Editor de asignación"]'), null);
  assert.ok(Array.from(document.querySelector('input[name="CardCode"]').attributes).some((a) => a.name.toLowerCase() === "readonly"));
  await act(async () => ingresar("CardName", "Almacén Norte"));
  assert.equal(document.querySelector('button[type="submit"]').textContent, "Guardar cambios");
  await act(async () => enviar());
  assert.equal(ediciones.length, 1);
  assert.equal(ediciones[0].url, "/campo/locales/00001");
  assert.equal(ediciones[0].cuerpo.CardName, "Almacén Norte");
  assert.equal(ediciones[0].cuerpo.CardCode, undefined);
  assert.equal(ediciones[0].cuerpo.radioMetros, 100, "La edición conserva el radio de marcación del local");
  assert.equal(document.querySelector('[role="dialog"]'), null, "Guardar Información cierra su modal");

  await act(async () => click(document.querySelector('[aria-label="Itinerario de Almacén Central"]')));
  assert.ok(document.querySelector('[aria-label="Editor de horarios"]'));
  assert.equal(document.querySelector('[aria-label="Editor de asignación"]'), null);
  assert.equal(document.querySelector('input[name="CardCode"]'), null);
  assert.equal(document.querySelector('[role="tablist"]'), null);
  await act(async () => click(document.querySelector('[aria-label="Cerrar"]')));

  await act(async () => click(document.querySelector('[aria-label="Asignación de Almacén Central"]')));
  assert.ok(document.querySelector('[aria-label="Editor de asignación"]'));
  assert.equal(document.querySelector('[aria-label="Editor de horarios"]'), null);
  assert.equal(document.querySelector('input[name="CardCode"]'), null);
  assert.equal(document.querySelector('[role="tablist"]'), null);
  await act(async () => click(document.querySelector('[aria-label="Cerrar"]')));
  // Supervisor: busca por persona (5 sugerencias) y sus locales, sin dirección ni a cargo.
  assert.match(document.body.textContent, /Calle 123/, "Los demás roles ven la dirección");
  usuarioPanel = { rol: { descripcion: "SUPERVISOR_REPOSITORES", equipoCampo: { nombre: "Repositores" } } };
  consultas.length = 0;
  await act(async () => root.render(createElement(LocalesPanel, { key: "supervisor" })));
  // El selector consulta en un setTimeout(0).
  await act(async () => new Promise((listo) => setTimeout(listo, 10)));
  assert.ok(document.querySelector('[aria-label="Buscar locales por repositor o impulsador"]'));
  assert.ok(consultas.includes("/campo/locales/colaboradores?page=1&limit=5&buscar="), consultas.join(" | "));
  assert.equal(document.querySelector('input[aria-label="Local asignado"]').disabled, true, "El local se elige después de la persona");
  assert.equal(document.querySelector('input[placeholder="Buscar local o código"]'), null);
  assert.ok(!consultas.some((u) => u.startsWith("/campo/locales?page")), "No carga locales hasta buscar");
  assert.match(document.body.textContent, /Elegí un repositor o impulsador/);
  await act(async () => enviar());
  assert.ok(consultas.includes("/campo/locales?page=1&limit=7"), consultas.join(" | "));
  assert.equal(document.querySelector("#filtros-administracion").hidden, true, "Al buscar se pliega la búsqueda");
  await act(async () => click(document.querySelector('[aria-controls="filtros-administracion"]')));
  assert.equal(document.querySelector("#filtros-administracion").hidden, false);
  assert.doesNotMatch(document.body.textContent, /Calle 123|Asignado/);
  console.log("OK: Administración, alta deshabilitada, Información/Itinerario/Asignación independientes, guardado, reintento y buscador por persona del supervisor; sin navegador.");
} finally {
  await act(async () => root.unmount());
}
