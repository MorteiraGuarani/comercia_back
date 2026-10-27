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
const { aplicarCambio, diasParaVencer, hoyEquipo, necesitaSincronizar, prepararCargasInventario } = modulo.exports;

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
assert.deepEqual(conAgua.items.map((i) => i.itemcode), ["B", "A"], "el agregado va al final");
assert.equal(aplicarCambio(conAgua, { tipo: "agregar", itemcode: "A", itemname: "Agua" }), conAgua);
assert.equal(local.items.length, 1, "no modifica el original");
const cargado = aplicarCambio(conAgua, {
  tipo: "cargas",
  fecha: "2026-10-22",
  cargas: [{ itemcode: "A", cantidad: 0, vencimiento: "2026-10-30" }],
});
assert.deepEqual(cargado.items[1], {
  itemcode: "A",
  itemname: "Agua",
  cantidad: 0,
  vencimiento: "2026-10-30",
  fecha: "2026-10-22",
});
assert.equal(cargado.items[0].fecha, "2026-10-21", "lo no cargado queda igual");
assert.deepEqual(
  aplicarCambio(cargado, { tipo: "quitar", itemcode: "B" }).items.map((i) => i.itemcode),
  ["A"],
);

// Cinco productos completos de siete: dos filas a medio cargar no bloquean el guardado.
const completas = Object.fromEntries(Array.from({ length: 5 }, (_, i) => [
  `P${i + 1}`, { cantidad: String(i), vencimiento: "2026-11-01" },
]));
const ediciones = {
  ...completas,
  P6: { cantidad: "6", vencimiento: "" },
  P7: { cantidad: "", vencimiento: "2026-11-01" },
};
const antes = structuredClone(ediciones);
const parcial = prepararCargasInventario(ediciones);
assert.deepEqual(parcial.cargas.map((c) => c.itemcode), ["P1", "P2", "P3", "P4", "P5"]);
assert.equal(parcial.cargas[0].cantidad, 0, "cero es una cantidad cargada, no un campo vacío");
assert.deepEqual(parcial.pendientes, { P6: ediciones.P6, P7: ediciones.P7 });
assert.deepEqual(ediciones, antes, "preparar el envío no pierde ni modifica los borradores");
assert.equal(prepararCargasInventario(completas).cargas.length, 5, "los otros productos no necesitan haber sido editados");

const siete = { ...local, items: Array.from({ length: 7 }, (_, i) => ({
  itemcode: `P${i + 1}`, itemname: `Producto ${i + 1}`, cantidad: i === 6 ? 9 : null,
  vencimiento: i === 6 ? "2026-11-10" : null, fecha: i === 6 ? "2026-10-21" : null,
})) };
const guardadoParcial = aplicarCambio(siete, { tipo: "cargas", fecha: "2026-10-22", cargas: parcial.cargas });
assert.equal(guardadoParcial.items.filter((i) => i.fecha === "2026-10-22").length, 5);
assert.deepEqual(guardadoParcial.items.slice(5), siete.items.slice(5), "lo no enviado conserva sus valores, incluso una carga anterior");

const pendientesInvalidos = {
  vacio: { cantidad: "", vencimiento: "" },
  negativo: { cantidad: "-1", vencimiento: "2026-11-01" },
  decimal: { cantidad: "1.5", vencimiento: "2026-11-01" },
  exceso: { cantidad: "1000001", vencimiento: "2026-11-01" },
  imposible: { cantidad: "3", vencimiento: "2026-02-31" },
};
const revisables = prepararCargasInventario({ ...completas, ...pendientesInvalidos });
assert.equal(revisables.cargas.length, 5, "una fila inválida tampoco descarta las completas");
assert.deepEqual(revisables.pendientes, pendientesInvalidos);
assert.deepEqual(prepararCargasInventario(pendientesInvalidos).cargas, [], "no se envían cargas vacías o inválidas");
const final = prepararCargasInventario({
  P6: { ...parcial.pendientes.P6, vencimiento: "2026-11-02" },
  P7: { ...parcial.pendientes.P7, cantidad: "7" },
});
assert.equal(final.cargas.length, 2, "se puede completar y guardar el resto después");
assert.deepEqual(final.pendientes, {});

console.log("inventario: ok");
