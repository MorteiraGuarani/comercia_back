import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

// Cascada de Jefatura · Desempeño: árbol del organigrama y totales por rama.
const codigo = ts.transpileModule(
  readFileSync(new URL("../src/utils/desempeno-jefatura.ts", import.meta.url), "utf8"),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } },
).outputText;
const modulo = { exports: {} };
vm.runInThisContext(`(function(module, exports, require) {${codigo}\n})`)(modulo, modulo.exports, (nombre) => {
  assert.equal(nombre, "@/utils/hoy-en-campo");
  return { pct: (parte, total) => (total ? Math.round((parte / total) * 100) : 0) };
});
const { arbolDesempeno, personasRama, resumenRama } = modulo.exports;

const persona = (id, superiorId, zona, extra = {}) => ({
  id, superiorId, zona, nombre: `P${id}`, iniciales: `P${id}`, telefono: "—",
  asistencia: "finalizado", estadoPresentismo: "PRESENTE", inicioJornada: "08:00", finJornada: "17:00",
  ruta: { total: 2, completadas: 2, enCurso: 0, incompletas: 0, ausentes: 0, pct: 100 },
  tareas: { total: 1, completadas: 1, obligPendientes: 0, pct: 100 },
  novedadesCount: 0, ...extra,
});
// Jefe 1 (no viene en la lista) → supervisora 2 → TeamLeader 3 → impulsadores 4 y 5;
// repositor 6 depende de la supervisora; 7 y 8 se apuntan entre sí (ciclo).
const lista = [
  persona(2, 1, "Supervisor_Impulsadores"),
  persona(3, 2, "TeamLeader"),
  persona(4, 3, "Impulsador", { asistencia: "ausente", estadoPresentismo: "AUSENTE", inicioJornada: null,
    ruta: { total: 3, completadas: 0, enCurso: 0, incompletas: 0, ausentes: 3, pct: 0 } }),
  persona(5, 3, "Impulsador"),
  persona(6, 2, "Repositor"),
  persona(7, 8, "Impulsador"),
  persona(8, 7, "Impulsador"),
];
const arbol = arbolDesempeno(lista);
assert.deepEqual(arbol.map((n) => n.persona.id), [2, 7, 8], "arriba: la supervisora y los del ciclo");
const supervisora = arbol[0];
assert.deepEqual(supervisora.hijos.map((n) => n.persona.id), [3, 6]);
assert.deepEqual(supervisora.hijos[0].hijos.map((n) => n.persona.id), [4, 5]);
assert.deepEqual(personasRama(supervisora).map((c) => c.id), [2, 3, 4, 5, 6]);
assert.equal(arbol.flatMap(personasRama).length, lista.length, "nadie queda afuera");

const r = resumenRama("2026-10-30", supervisora);
assert.equal(r.presentismo.totalEquipo, 5);
assert.equal(r.presentismo.ausentes, 1);
assert.equal(r.presentismo.finalizados, 4);
assert.equal(r.presentismo.estados.AUSENTE, 1);
assert.deepEqual(
  { total: r.rutas.total, completadas: r.rutas.completadas, ausentes: r.rutas.ausentes, pct: r.rutas.pct },
  { total: 11, completadas: 8, ausentes: 3, pct: 73 },
);
assert.equal(r.tareas.total, 5);
assert.equal(r.liderazgo.totalTeamLeaders, 1, "el TeamLeader a cargo de la supervisora");
assert.equal(r.colaboradores.length, 5);
console.log("Jefatura: cascada del organigrama y totales por rama OK.");
