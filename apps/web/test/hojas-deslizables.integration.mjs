import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { posix } from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { parseHTML } from "linkedom";
import { act, createElement as h, useState } from "react";

// React y eventos DOM en Node. No abre navegador ni consulta servicios.
const { window, document } = parseHTML('<html><body><button id="abrir">Abrir</button><div id="app"></div></body></html>');
Object.assign(globalThis, { window, document, HTMLElement: window.HTMLElement, Element: window.Element, IS_REACT_ACT_ENVIRONMENT: true });
const require = createRequire(import.meta.url);
const { createRoot } = require("react-dom/client");
let movil = true;
let reducido = false;
const suscriptores = new Set();
window.matchMedia = (consulta) => ({
  matches: consulta.includes("reduced-motion") ? reducido : movil,
  addEventListener: (_, avisar) => suscriptores.add(avisar),
  removeEventListener: (_, avisar) => suscriptores.delete(avisar),
});
let foco = document.body;
Object.defineProperty(document, "activeElement", { get: () => foco });
window.HTMLElement.prototype.focus = function () { foco = this.closest("*"); };
window.HTMLElement.prototype.getBoundingClientRect = () => ({ height: 600, width: 360, top: 100, bottom: 700, left: 0, right: 360 });
window.HTMLElement.prototype.setPointerCapture = function (id) { this.capturado = id; };
window.HTMLElement.prototype.hasPointerCapture = function (id) { return this.capturado === id; };
window.HTMLElement.prototype.releasePointerCapture = function () { this.capturado = null; };

let reloj = 0;
let secuencia = 0;
const pendientes = new Map();
function programar(callback, espera) {
  const id = ++secuencia;
  pendientes.set(id, { callback, cuando: reloj + espera });
  return id;
}
async function avanzar(ms) {
  await act(async () => {
    reloj += ms;
    for (const [id, tarea] of [...pendientes]) {
      if (tarea.cuando <= reloj) { pendientes.delete(id); tarea.callback(); }
    }
  });
}
const cache = new Map();
function cargar(ruta) {
  if (cache.has(ruta)) return cache.get(ruta).exports;
  const modulo = { exports: {} };
  cache.set(ruta, modulo);
  const js = ts.transpileModule(readFileSync(new URL(`../src/${ruta}`, import.meta.url), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const importar = (nombre) => {
    if (!nombre.startsWith("@/") && !nombre.startsWith(".")) return require(nombre);
    const base = nombre.startsWith("@/") ? nombre.slice(2) : posix.join(posix.dirname(ruta), nombre);
    return cargar(base + (existsSync(new URL(`../src/${base}.tsx`, import.meta.url)) ? ".tsx" : ".ts"));
  };
  vm.runInNewContext(js, { module: modulo, exports: modulo.exports, require: importar, window, document,
    setTimeout: programar, clearTimeout: (id) => pendientes.delete(id) }, { filename: ruta });
  return modulo.exports;
}
const { Modal } = cargar("components/modal.tsx");
const { SelectorFechaFiltro } = cargar("components/campo/ui/selector-fecha-filtro.tsx");
const root = createRoot(document.getElementById("app"));
let cierres = 0;
let rechazarCierre = false;
let pulsaciones = 0;
function Ejemplo({ hoja = true }) {
  const [abierto, setAbierto] = useState(true);
  return h(Modal, { titulo: "Inventario", abierto, hojaMovil: hoja,
    onCerrar: () => { cierres++; if (!rechazarCierre) setAbierto(false); },
    encabezado: h("div", null, h("span", { id: "titulo" }, "Inventario"), h("button", { onClick: () => pulsaciones++ }, "Pestaña")),
  }, h("input", { defaultValue: "27", "aria-label": "Cantidad" }));
}
async function abrir(props = {}) {
  await act(async () => { root.render(null); });
  document.getElementById("abrir").focus();
  await act(async () => { root.render(h(Ejemplo, props)); });
  return document.querySelector('[role="dialog"]');
}
async function evento(nodo, tipo, datos = {}) {
  await act(async () => {
    const e = new window.Event(tipo, { bubbles: true, cancelable: true });
    for (const [clave, valor] of Object.entries(datos)) Object.defineProperty(e, clave, { value: valor });
    nodo.dispatchEvent(e);
  });
}
const puntero = (nodo, tipo, y, tiempo, id = 1) => evento(nodo, tipo, { clientY: y, timeStamp: tiempo, pointerId: id, button: 0, isPrimary: true });

// El toque exterior anima y cierra una sola vez, devolviendo el foco.
let dialogo = await abrir();
const antes = cierres;
await evento(dialogo.previousElementSibling, "click");
assert.match(dialogo.style.transform, /624px/);
assert.equal(cierres, antes);
await avanzar(219);
assert.ok(document.querySelector('[role="dialog"]'));
await avanzar(1);
assert.equal(cierres, antes + 1);
assert.equal(document.querySelector('[role="dialog"]'), null);
assert.equal(document.activeElement, document.getElementById("abrir"));

// Un arrastre largo puede revertirse antes de soltar, manteniendo lo escrito.
dialogo = await abrir();
let cabecera = dialogo.querySelector("header").parentElement;
let titulo = dialogo.querySelector("#titulo");
dialogo.querySelector("input").value = "123";
await puntero(titulo, "pointerdown", 100, 0);
await puntero(cabecera, "pointermove", 500, 200);
assert.match(dialogo.style.transform, /400px/);
assert.equal(cierres, antes + 1, "No cierra mientras el dedo continúa presionado");
await puntero(cabecera, "pointermove", 300, 300);
await puntero(cabecera, "pointerup", 300, 310);
assert.match(dialogo.style.transform, /0px/);
await avanzar(500);
assert.equal(cierres, antes + 1, "Volver hacia arriba cancela la minimización");
assert.equal(dialogo.querySelector("input").value, "123");

// Movimiento corto, cancelación del sistema y otros dedos no cierran la hoja.
await puntero(titulo, "pointerdown", 100, 400);
await puntero(cabecera, "pointermove", 140, 700);
await puntero(cabecera, "pointerup", 140, 710);
await avanzar(300);
assert.equal(cierres, antes + 1);
await puntero(titulo, "pointerdown", 100, 800);
await puntero(cabecera, "pointermove", 400, 900, 2);
await puntero(cabecera, "pointercancel", 400, 910, 2);
await puntero(cabecera, "pointermove", 350, 1000);
assert.match(dialogo.style.transform, /250px/);
await puntero(cabecera, "pointercancel", 350, 1010);
assert.match(dialogo.style.transform, /0px/);
await avanzar(300);
assert.equal(cierres, antes + 1);

// El contenido conserva sus gestos y las acciones del encabezado siguen operativas.
await puntero(dialogo.querySelector("input"), "pointerdown", 100, 1100);
await puntero(cabecera, "pointermove", 500, 1200);
await puntero(cabecera, "pointerup", 500, 1210);
assert.match(dialogo.style.transform, /0px/);
const pestana = dialogo.querySelector("header button");
await puntero(pestana, "pointerdown", 100, 1300);
await evento(pestana, "click");
assert.equal(pulsaciones, 1);

// Soltar suficientemente abajo o hacer un gesto rápido minimiza.
await puntero(titulo, "pointerdown", 100, 1400);
await puntero(cabecera, "pointermove", 350, 1600);
await puntero(cabecera, "pointerup", 350, 1610);
await avanzar(220);
assert.equal(document.querySelector('[role="dialog"]'), null);
dialogo = await abrir();
cabecera = dialogo.querySelector("header").parentElement;
await puntero(dialogo.querySelector("#titulo"), "pointerdown", 100, 1700);
await puntero(cabecera, "pointermove", 160, 1720);
await puntero(cabecera, "pointerup", 160, 1730);
await avanzar(220);
assert.equal(document.querySelector('[role="dialog"]'), null);

// Si el formulario rechaza el cierre, restaura la hoja y sus datos.
rechazarCierre = true;
dialogo = await abrir();
dialogo.querySelector("input").value = "456";
await evento(dialogo.previousElementSibling, "click");
await avanzar(220);
assert.equal(document.querySelector('[role="dialog"]'), dialogo);
assert.equal(dialogo.style.transform, "");
assert.equal(dialogo.querySelector("input").value, "456");
rechazarCierre = false;

// Modales centrados y escritorio mantienen su comportamiento de fondo.
dialogo = await abrir({ hoja: false });
const antesEscritorio = cierres;
await evento(dialogo.previousElementSibling, "click");
await avanzar(500);
assert.equal(cierres, antesEscritorio);
movil = false;
await act(async () => { for (const avisar of suscriptores) avisar(); });
dialogo = await abrir();
await evento(dialogo.previousElementSibling, "click");
await avanzar(500);
assert.equal(cierres, antesEscritorio);

// El calendario móvil comparte el gesto; su formulario no se toca durante el arrastre.
movil = true;
await act(async () => { root.render(null); root.render(h(SelectorFechaFiltro, { valorActual: { clave: "hoy", etiqueta: "Hoy" }, onChange() {} })); });
await evento(document.querySelector('[aria-haspopup="dialog"]'), "click");
dialogo = document.querySelector('[role="dialog"]');
cabecera = dialogo.firstElementChild;
await puntero(cabecera.firstElementChild, "pointerdown", 100, 2000);
await puntero(cabecera, "pointermove", 350, 2200);
await puntero(cabecera, "pointerup", 350, 2210);
await avanzar(220);
assert.equal(document.querySelector('[role="dialog"]'), null);

// El movimiento reducido conserva el cierre, sin esperar una animación.
reducido = true;
dialogo = await abrir();
await evento(dialogo.previousElementSibling, "click");
await avanzar(0);
assert.equal(document.querySelector('[role="dialog"]'), null);
await act(async () => { root.unmount(); });
assert.equal(pendientes.size, 0);
console.log("OK: fondo, arrastre reversible, umbral/velocidad, cancelación, scroll, controles, confirmaciones, calendario y movimiento reducido.");
