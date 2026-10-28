import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import { parseHTML } from "linkedom";
import { act, createElement } from "react";

// Prueba DOM en Node: no inicia un navegador ni necesita servicios externos.
const { window, document } = parseHTML(
  '<html><body><header id="cabecera"><div id="app"></div></header><nav id="navegacion"></nav></body></html>',
);
Object.assign(globalThis, {
  window,
  document,
  HTMLElement: window.HTMLElement,
  SVGElement: window.SVGElement,
  Element: window.Element,
  IS_REACT_ACT_ENVIRONMENT: true,
  requestAnimationFrame: (callback) => setTimeout(() => callback(performance.now()), 5),
  cancelAnimationFrame: clearTimeout,
});
window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
window.getComputedStyle = (element) => ({
  getPropertyValue: (propiedad) => element.style.getPropertyValue(propiedad),
  transform: element.style.transform || "none",
  opacity: element.style.opacity || "1",
});
window.visualViewport = { height: 852, offsetTop: 0, addEventListener() {}, removeEventListener() {} };
Object.defineProperty(document, "hidden", { value: false, configurable: true });
Object.defineProperty(document, "activeElement", { value: document.body, writable: true });
window.HTMLElement.prototype.focus = function () { document.activeElement = this; };

const require = createRequire(import.meta.url);
const { createRoot } = require("react-dom/client");
const solicitudes = [];
class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
function apiFetch(path, { signal } = {}) {
  assert.equal(path, "/campo/jornada/repositor/telefono");
  return new Promise((resolve, reject) => {
    const solicitud = { signal, resolve, reject };
    solicitudes.push(solicitud);
    signal?.addEventListener("abort", () => reject(new ApiError(0, "Consulta cancelada")), { once: true });
  });
}
const aliases = {
  "@/components/modal": "components/modal.tsx",
  "@/components/pantalla-carga": "components/pantalla-carga.tsx",
  "@/hooks/use-estado-telefono-repositor": "hooks/use-estado-telefono-repositor.ts",
  "@/hooks/use-destino-portal": "hooks/use-destino-portal.ts",
  "@/utils/fechas": "utils/fechas.ts",
  "./tokens": "components/campo/tokens.ts",
};
const modulos = new Map();
function cargarModulo(ruta) {
  if (modulos.has(ruta)) return modulos.get(ruta).exports;
  const modulo = { exports: {} };
  modulos.set(ruta, modulo);
  const fuente = readFileSync(new URL(`../src/${ruta}`, import.meta.url), "utf8");
  const js = ts.transpileModule(fuente, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(js, {
    module: modulo,
    exports: modulo.exports,
    require: (nombre) => nombre === "@/lib/api" ? { apiFetch, ApiError }
      : nombre === "@/hooks/use-hoja-deslizable"
        ? { useHojaDeslizable: () => ({ minimizar() {}, arrastre: {} }) }
        : aliases[nombre] ? cargarModulo(aliases[nombre]) : require(nombre),
    window, document, AbortController, setTimeout, clearTimeout, setInterval, clearInterval, queueMicrotask,
  }, { filename: ruta });
  return modulo.exports;
}
const { EstadoTelefono } = cargarModulo("components/campo/estado-telefono.tsx");
let root = createRoot(document.getElementById("app"));
const dialogo = () => document.querySelector('[role="dialog"]');
const carga = () => Array.from(document.querySelectorAll('[role="status"]'))
  .find((elemento) => elemento.getAttribute("aria-busy") === "true");
const click = (boton) => {
  assert.ok(boton, "El control debe estar disponible");
  boton.focus();
  boton.dispatchEvent(new window.Event("click", { bubbles: true }));
};
const listo = { estado: "LISTO", mensaje: "Ubicación reciente recibida de UCheck", capturadaEn: "2026-10-14T13:00:00Z", precisionMetros: 8 };
let fase = "montaje";
const limitePrueba = setTimeout(() => { throw new Error(`Prueba de UCheck excedió 10 s en: ${fase}`); }, 10_000);

try {
  await act(async () => root.render(createElement(EstadoTelefono, { variante: "boton" })));
  assert.equal(solicitudes.length, 1);
  await act(async () => solicitudes[0].resolve(listo));

  const abrir = document.querySelector('button[aria-haspopup="dialog"]');
  fase = "abrir y consultar";
  await act(async () => click(abrir));
  assert.equal(solicitudes.length, 2, "Tocar UCheck seguimiento debe consultar nuevamente el teléfono");
  assert.ok(dialogo(), "La comprobación debe dejar un diálogo abierto");
  assert.equal(dialogo().closest("#cabecera"), null, "El modal no debe quedar atrapado bajo la navegación");
  assert.notEqual(dialogo().style.opacity, "0", "El resultado debe ser visible desde la apertura");
  assert.ok(carga()?.textContent.includes("Comprobando UCheck"), "La consulta debe mostrar el backdrop de comprobación");
  assert.ok(carga().parentElement === document.body, "El backdrop debe estar sobre el modal, fuera de las capas de la página");

  fase = "mostrar resultado";
  await act(async () => solicitudes[1].resolve({ estado: "SEGUIMIENTO_DETENIDO", mensaje: "Iniciá el seguimiento laboral en UCheck para marcar en Comercia" }));
  assert.equal(carga(), undefined);
  assert.ok(dialogo()?.textContent.includes("Iniciá el seguimiento"));
  assert.ok(dialogo()?.textContent.includes("Última comprobación"), "El resultado debe confirmar cuándo se comprobó");

  fase = "reintento";
  await act(async () => click(dialogo().querySelector('button[aria-label="Comprobar UCheck"]')));
  assert.equal(solicitudes.length, 3);
  assert.ok(carga());
  await act(async () => solicitudes[2].reject(new ApiError(0, "Sin conexión")));
  assert.equal(carga(), undefined);
  assert.ok(dialogo()?.textContent.includes("No se pudo consultar"), "Una falla debe dejar un mensaje y permitir reintentar");

  await act(async () => click(dialogo().querySelector('button[aria-label="Comprobar UCheck"]')));
  await act(async () => solicitudes[3].resolve(listo));
  assert.ok(dialogo()?.textContent.includes("Listo para marcar"));
  assert.ok(dialogo()?.textContent.includes("precisión"));
  assert.equal(carga(), undefined);

  await act(async () => {
    fase = "cerrar con Escape";
    const escape = new window.Event("keydown");
    escape.key = "Escape";
    document.dispatchEvent(escape);
  });
  assert.ok(dialogo() === null, "El diálogo debe cerrarse con Escape");
  assert.ok(document.activeElement === abrir, "El foco debe volver al botón al cerrar");
  assert.equal(document.body.style.overflow || "", "");
  await act(async () => root.unmount());

  fase = "doble clic y cancelación";
  root = createRoot(document.getElementById("app"));
  await act(async () => root.render(createElement(EstadoTelefono, { variante: "boton" })));
  const anterior = solicitudes.at(-1);
  const cantidadAntes = solicitudes.length;
  const abrirPendiente = document.querySelector('button[aria-haspopup="dialog"]');
  await act(async () => { click(abrirPendiente); click(abrirPendiente); });
  assert.equal(anterior.signal.aborted, true, "La comprobación manual debe reemplazar una consulta anterior pendiente");
  assert.equal(solicitudes.length, cantidadAntes + 1, "Un doble clic no debe duplicar la consulta");
  await act(async () => solicitudes.at(-1).resolve(listo));
  assert.ok(dialogo()?.textContent.includes("Listo para marcar"));
  assert.equal(carga(), undefined, "Una respuesta anterior no debe dejar bloqueado el backdrop");
  console.log("UCheck: apertura, backdrop, resultados, reintento, foco y consultas concurrentes OK.");
} finally {
  await act(async () => root.unmount());
  clearTimeout(limitePrueba);
}
