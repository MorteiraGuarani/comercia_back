import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

// Armado del árbol del organigrama (src/utils/organigrama.ts).
const js = ts.transpileModule(
  readFileSync(new URL("../src/utils/organigrama.ts", import.meta.url), "utf8"),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } },
).outputText;
const modulo = { exports: {} };
vm.runInThisContext(`(function (module, exports, require) {${js}
})`)(modulo, modulo.exports, () => ({}));
const { armarArbol, caminoHasta, estadoHoy } = modulo.exports;

const hoy = { locales: 0, visitas: 0, entrada: null, enCurso: false };
const p = (id, superiorId, nombre = `P${id}`, extra = {}) => ({ id, superiorId, nombre, activo: true, hoy, ...extra });
const ids = (nodos) => nodos.map((n) => [n.persona.id, n.total, ids(n.hijos)]);

const personas = [
  p(1, null, "Supervisor"),
  p(2, 1, "Back office"),
  p(3, 2, "Repositor"),
  p(4, null, "Suelto"),
  p(5, 99, "Superior fuera"),
  p(6, 7, "Ciclo A"),
  p(7, 6, "Ciclo B"),
];
// Raíces: sin superior o con superior que no está; los más grandes primero.
// El ciclo no se pierde: entra como raíz.
assert.deepEqual(ids(armarArbol(personas, null)), [
  [1, 2, [[2, 1, [[3, 0, []]]]]],
  [6, 1, [[7, 0, []]]],
  [4, 0, []],
  [5, 0, []],
]);
// Vista de un líder: solo su rama.
assert.deepEqual(ids(armarArbol(personas, 2)), [[2, 1, [[3, 0, []]]]]);
assert.deepEqual(caminoHasta(personas, 3), [1, 2, 3]);
assert.deepEqual(caminoHasta(personas, 6), [7, 6]);

assert.equal(estadoHoy(p(1, null, "x", { hoy: { ...hoy, entrada: "08:05", enCurso: true } })).texto, "En local desde 08:05");
assert.equal(estadoHoy(p(1, null, "x", { hoy: { ...hoy, entrada: "08:05" } })).texto, "Entrada 08:05");
assert.equal(estadoHoy(p(1, null)).tono, "sin");
assert.equal(estadoHoy(p(1, null, "x", { activo: false })).tono, "baja");

console.log("OK: árbol del organigrama, raíces, ciclos, camino y estado de hoy");
