import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import { parseHTML } from "linkedom";
import { act, createElement } from "react";

// DOM en Node: sin navegador ni llamadas a la API real.
const { window, document } = parseHTML('<html><body><div id="app"></div></body></html>');
Object.assign(globalThis, { window, document, HTMLElement: window.HTMLElement, Element: window.Element, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(document, "activeElement", { value: document.body, writable: true });
window.HTMLElement.prototype.focus = function () { document.activeElement = this; };
const require = createRequire(import.meta.url);
const { createRoot } = require("react-dom/client");
const aliases = {
  "@/components/modal": "components/modal.tsx",
  "@/hooks/use-destino-portal": "hooks/use-destino-portal.ts",
};
const cache = new Map();
function cargar(ruta) {
  if (cache.has(ruta)) return cache.get(ruta).exports;
  const modulo = { exports: {} };
  cache.set(ruta, modulo);
  const js = ts.transpileModule(readFileSync(new URL(`../src/${ruta}`, import.meta.url), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(js, { module: modulo, exports: modulo.exports, require: (nombre) => aliases[nombre] ? cargar(aliases[nombre]) : require(nombre), window, document }, { filename: ruta });
  return modulo.exports;
}
const { ConfirmarEliminacionCampo } = cargar("components/campo/confirmar-eliminacion-campo.tsx");
const root = createRoot(document.getElementById("app"));
const confirmaciones = [];
let cierres = 0;
const props = { tipo: "cliente", nombre: "Cliente de prueba", cantidadLocales: 2, procesando: false, error: null, onCerrar: () => cierres++, onConfirmar: (borrar) => confirmaciones.push(borrar) };
const render = (extra = {}) => act(async () => root.render(createElement(ConfirmarEliminacionCampo, { ...props, ...extra })));
const submit = () => act(async () => document.querySelector("form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })));
try {
  await render();
  assert.ok(document.querySelector('[role="dialog"]').textContent.includes("2 locales asociados"));
  assert.equal(confirmaciones.length, 0, "Abrir la confirmacion no debe borrar nada");
  await submit();
  assert.deepEqual(confirmaciones, [false], "La confirmacion debe conservar los locales por defecto");
  await act(async () => document.querySelector('input[value="eliminar"]').dispatchEvent(new window.Event("click", { bubbles: true })));
  await submit();
  assert.deepEqual(confirmaciones, [false, true], "Eliminar los locales requiere seleccion explicita");
  await render({ procesando: true });
  await submit();
  assert.equal(confirmaciones.length, 2, "No se deben duplicar las solicitudes mientras se procesa");
  const escape = new window.Event("keydown");
  escape.key = "Escape";
  await act(async () => document.dispatchEvent(escape));
  assert.equal(cierres, 0, "No debe cerrarse durante la eliminacion");
  await render({ error: "No se pudo eliminar" });
  assert.equal(document.querySelector('[role="alert"]').textContent, "No se pudo eliminar");
  await act(async () => document.querySelector('div[aria-hidden="true"]').dispatchEvent(new window.Event("click", { bubbles: true })));
  assert.equal(cierres, 0, "El fondo no debe cerrar el modal");
  await act(async () => document.dispatchEvent(escape));
  assert.equal(cierres, 1, "Escape permite cancelar cuando no hay operacion en curso");
  await render({ tipo: "local", cantidadLocales: 0 });
  assert.equal(document.querySelectorAll('input[type="radio"]').length, 0);
  assert.ok(document.querySelector('[role="dialog"]').textContent.includes("marcaciones y evidencias"));
  console.log("OK: confirmacion de borrado, conservacion por defecto, errores y bloqueo de solicitudes duplicadas");
} finally {
  await act(async () => root.unmount());
}
