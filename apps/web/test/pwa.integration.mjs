import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import { parseHTML } from 'linkedom';
import { act, createElement } from 'react';

const { window, document } = parseHTML('<html><body><div id="app"></div></body></html>');
const navegador = { userAgent: 'Android', platform: 'Linux', maxTouchPoints: 5 };
const listeners = new Set();
const media = {
  matches: false,
  addEventListener: (_tipo, listener) => listeners.add(listener),
  removeEventListener: (_tipo, listener) => listeners.delete(listener),
};
window.isSecureContext = true;
window.matchMedia = () => media;
Object.assign(globalThis, { window, document, HTMLElement: window.HTMLElement, Element: window.Element, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: navegador });
const require = createRequire(import.meta.url);
const { createRoot } = require('react-dom/client');
const codigo = ts.transpileModule(readFileSync(new URL('../src/components/instalacion-pwa.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const modulo = { exports: {} };
vm.runInNewContext(codigo, { module: modulo, exports: modulo.exports, require, window, navigator: navegador });
const { InstalacionPwaProvider, BotonInstalarPwa } = modulo.exports;
const nodo = document.getElementById('app');
let root = createRoot(nodo);
const vista = () => createElement(InstalacionPwaProvider, null, createElement(BotonInstalarPwa, { className: 'accion' }));
await act(async () => root.render(vista()));
assert.equal(nodo.querySelector('button'), null);
const invitacion = new window.Event('beforeinstallprompt', { cancelable: true });
let llamadas = 0;
invitacion.prompt = async () => { llamadas += 1; };
invitacion.userChoice = Promise.resolve({ outcome: 'accepted' });
await act(async () => window.dispatchEvent(invitacion));
assert.equal(nodo.querySelector('button').textContent, 'Instalar comercIA');
await act(async () => nodo.querySelector('button').click());
assert.equal(llamadas, 1);
assert.equal(nodo.querySelector('button'), null);
await act(async () => root.unmount());

navegador.userAgent = 'iPhone';
root = createRoot(nodo);
await act(async () => root.render(vista()));
await act(async () => nodo.querySelector('button').click());
assert.match(nodo.querySelector('[role="status"]').textContent, /Agregar a inicio/);
await act(async () => { media.matches = true; for (const notificar of listeners) notificar(); });
assert.equal(nodo.querySelector('button'), null);
await act(async () => root.unmount());
console.log('OK: invitación de instalación, instrucciones iPhone y modo instalado');
