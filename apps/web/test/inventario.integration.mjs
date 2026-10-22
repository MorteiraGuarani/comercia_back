import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

// Reglas puras del inventario sin conexión (src/utils/inventario.ts).
const js = ts.transpileModule(
  readFileSync(new URL("../src/utils/inventario.ts", import.meta.url), "utf8"),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } },
).outputText;
const modulo = { exports: {} };
// En este mismo contexto: arrays y objetos se comparan con los de Node.
vm.runInThisContext(`(function (module, exports, require) {${js}
})`)(modulo, modulo.exports, () => ({}));
const { aplicarCambio, diasParaVencer, hoyEquipo, necesitaSincronizar } = modulo.exports;

const hora = (dia, h, m = 0) => new Date(2026, 9, dia, h, m).getTime();

// Primera conexión del día y otra vez desde el mediodía.
assert.equal(necesitaSincronizar(undefined, hora(22, 8)), true);
assert.equal(necesitaSincronizar(hora(21, 23), hora(22, 7)), true);
assert.equal(necesitaSincronizar(hora(22, 7), hora(22, 11, 59)), false);
assert.equal(necesitaSincronizar(hora(22, 7), hora(22, 12)), true);
assert.equal(necesitaSincronizar(hora(22, 12, 30), hora(22, 18)), false);

assert.equal(hoyEquipo(new Date(2026, 0, 5, 23, 59)), "2026-01-05");
assert.equal(diasParaVencer("2026-10-27", "2026-10-22"), 5);
assert.equal(diasParaVencer("2026-10-21", "2026-10-22"), -1);
assert.equal(diasParaVencer("2026-11-01", "2026-10-31"), 1);

const local = {
  usuarioId: 1,
  id: "C1",
  nombre: "Uno",
  direccion: "",
  busqueda: "uno",
  fechas: [],
  items: [{ itemcode: "B", itemname: "Banana", cantidad: 2, vencimiento: "2026-11-01", fecha: "2026-10-21" }],
};
const conAgua = aplicarCambio(local, { tipo: "agregar", itemcode: "A", itemname: "Agua" });
assert.deepEqual(conAgua.items.map((i) => i.itemcode), ["A", "B"], "ordena por nombre");
assert.equal(aplicarCambio(conAgua, { tipo: "agregar", itemcode: "A", itemname: "Agua" }), conAgua);
assert.equal(local.items.length, 1, "no modifica el original");
const cargado = aplicarCambio(conAgua, {
  tipo: "cargas",
  fecha: "2026-10-22",
  cargas: [{ itemcode: "A", cantidad: 0, vencimiento: "2026-10-30" }],
});
assert.deepEqual(cargado.items[0], {
  itemcode: "A",
  itemname: "Agua",
  cantidad: 0,
  vencimiento: "2026-10-30",
  fecha: "2026-10-22",
});
assert.equal(cargado.items[1].fecha, "2026-10-21", "lo no cargado queda igual");
assert.deepEqual(
  aplicarCambio(cargado, { tipo: "quitar", itemcode: "B" }).items.map((i) => i.itemcode),
  ["A"],
);

console.log("inventario: ok");
