import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import { parseHTML } from 'linkedom';
import { act, createElement } from 'react';

const { window, document } = parseHTML('<html><body><div id="app"></div></body></html>');
Object.assign(globalThis, { window, document, HTMLElement: window.HTMLElement, Element: window.Element, IS_REACT_ACT_ENVIRONMENT: true });
window.HTMLElement.prototype.setCustomValidity = function () {};
const require = createRequire(import.meta.url);
const { createRoot } = require('react-dom/client');
let items = [];
const stubs = {
  '@/lib/api': { ApiError: class extends Error {}, apiFetch: async () => ({ items, total: items.length, page: 1, limit: 7, totalPages: 1 }) },
  '@/components/paginacion': { Paginacion: () => null },
  '@/components/pantalla-carga': { PantallaCarga: () => null },
  '@/components/ui': {},
};
function cargar(ruta) {
  const modulo = { exports: {} };
  const js = ts.transpileModule(readFileSync(new URL(`../src/${ruta}`, import.meta.url), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(js, { module: modulo, exports: modulo.exports, require: (nombre) => stubs[nombre] ?? require(nombre), window, document, setTimeout, clearTimeout, AbortController }, { filename: ruta });
  return modulo.exports;
}
const { SelectorPaginado } = cargar('components/selector-paginado.tsx');
const { normalizarPrecio } = cargar('utils/precio-producto.ts');
const root = createRoot(document.getElementById('app'));
try {
  for (const [id, buscable] of [[12, false], ['0001', false], ['0001', true]]) {
    items = [{ id, nombre: 'Registro' }];
    const cambios = [];
    await act(async () => {
      root.render(createElement(SelectorPaginado, { key: `${id}:${buscable}`, url: '/aislado', etiqueta: 'Registro', value: '', buscable, onChange: (valor) => cambios.push(valor) }));
    });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); });
    if (buscable) {
      await act(async () => document.querySelector('input').dispatchEvent(new window.Event('click', { bubbles: true })));
      await act(async () => document.querySelector('[role="option"]').dispatchEvent(new window.Event('click', { bubbles: true })));
    } else {
      const select = document.querySelector('select');
      Object.defineProperty(select, 'value', { value: String(id), configurable: true });
      await act(async () => select.dispatchEvent(new window.Event('change', { bubbles: true })));
    }
    assert.equal(cambios.at(-1), id, 'El selector conserva el tipo y los ceros del identificador');
  }
  assert.equal(normalizarPrecio(' 000123,123456 '), '123.123456');
  assert.equal(normalizarPrecio('999999999999999.123456'), '999999999999999.123456');
  console.log('OK: selector numérico, CardCode con ceros y precio exacto sin navegador');
} finally {
  await act(async () => root.unmount());
}
