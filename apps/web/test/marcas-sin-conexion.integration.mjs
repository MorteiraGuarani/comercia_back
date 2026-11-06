import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

// Marcas guardadas en el navegador sin conexión con Ucheck: se guardan una
// vez, se mandan en orden, un corte deja el resto y un rechazo pasa a
// rechazadas hasta que quien marcó toca "Entendido".
class ApiError extends Error {
  constructor(status, message, codigo) {
    super(message);
    this.status = status;
    this.codigo = codigo;
  }
}
const almacen = new Map();
globalThis.localStorage = {
  getItem: (k) => almacen.get(k) ?? null,
  setItem: (k, v) => almacen.set(k, v),
};
let eventos = 0;
globalThis.window = { dispatchEvent: () => eventos++ };
const respuestas = [];
const pedidos = [];
const apiFetch = (ruta, init) => {
  pedidos.push(JSON.parse(init.body));
  const r = respuestas.shift();
  return r instanceof Error ? Promise.reject(r) : Promise.resolve(r ?? {});
};
const codigo = ts.transpileModule(
  readFileSync(new URL("../src/lib/marcas-sin-conexion.ts", import.meta.url), "utf8"),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } },
).outputText;
const modulo = { exports: {} };
vm.runInThisContext(`(function(module, exports, require) {${codigo}\n})`)(modulo, modulo.exports, (nombre) => {
  if (nombre === "@/lib/api") return { ApiError, apiFetch };
  if (nombre === "@/utils/error") return { mensajeError: (e, f) => e?.message || f };
  throw new Error(`Dependencia sin simular: ${nombre}`);
});
const {
  guardarMarcaSinConexion, leerMarcasSinConexion, enviarMarcasSinConexion, esSinConexion,
  leerMarcasRechazadas, descartarMarcaRechazada,
} = modulo.exports;

const marca = (id, tipo, asignacionId) => ({
  id, tipo, asignacionId, horarioId: null, fecha: "2026-10-30", tomadaEn: "2026-10-30T13:00:00.000Z", nota: "",
  ubicacion: { latitud: -25.3, longitud: -57.6, precisionMetros: 9, capturadaEn: "2026-10-30T12:59:58.000Z" },
  local: { id: "C1", nombre: `Local ${asignacionId}`, radioMetros: 100 },
});
guardarMarcaSinConexion(7, marca("a", "ENTRADA", 1));
guardarMarcaSinConexion(7, marca("a2", "ENTRADA", 1));
guardarMarcaSinConexion(7, marca("b", "SALIDA", 1));
guardarMarcaSinConexion(7, marca("c", "ENTRADA", 2));
assert.deepEqual(leerMarcasSinConexion(7).map((m) => m.id), ["a", "b", "c"], "la misma marca no se guarda dos veces");
assert.deepEqual(leerMarcasSinConexion(8), [], "cada cuenta tiene su lista");
assert.equal(eventos, 3);

assert.equal(esSinConexion(new ApiError(0, "sin red")), true);
assert.equal(esSinConexion(new ApiError(503, "x", "UCHECK_SIN_CONEXION")), true);
assert.equal(esSinConexion(new ApiError(400, "fuera de radio")), false);

// Primera entrada llega; la salida encuentra Ucheck caído: quedan la salida y la siguiente.
respuestas.push({}, new ApiError(503, "Ucheck caído", "UCHECK_SIN_CONEXION"));
let r = await enviarMarcasSinConexion(7);
assert.deepEqual(r.enviadas.map((m) => m.id), ["a"]);
assert.deepEqual(leerMarcasSinConexion(7).map((m) => m.id), ["b", "c"]);
assert.deepEqual(pedidos[0], {
  tipo: "ENTRADA", asignacionId: 1, fecha: "2026-10-30", tomadaEn: "2026-10-30T13:00:00.000Z", nota: "",
  ubicacion: { latitud: -25.3, longitud: -57.6, precisionMetros: 9, capturadaEn: "2026-10-30T12:59:58.000Z" },
});

// Un 500 no es un rechazo: la marca se conserva.
respuestas.push(new ApiError(500, "error interno"));
r = await enviarMarcasSinConexion(7);
assert.equal(leerMarcasSinConexion(7).length, 2);

// 401/403 de Comercia (sesión vencida): no es un rechazo, se conserva.
respuestas.push(new ApiError(401, "Sesión vencida"));
r = await enviarMarcasSinConexion(7);
assert.deepEqual(leerMarcasSinConexion(7).map((m) => m.id), ["b", "c"]);
assert.deepEqual(leerMarcasRechazadas(7), []);

// Rechazo de Ucheck (radio): sale de la cola y queda en rechazadas; la siguiente sigue.
respuestas.push(new ApiError(400, "Estás fuera del radio permitido de 100 m"), {});
r = await enviarMarcasSinConexion(7);
assert.deepEqual(r.rechazadas.map((x) => [x.marca.id, x.motivo]), [["b", "Estás fuera del radio permitido de 100 m"]]);
assert.deepEqual(r.enviadas.map((m) => m.id), ["c"]);
assert.deepEqual(leerMarcasSinConexion(7), []);
const [rechazada] = leerMarcasRechazadas(7);
assert.equal(leerMarcasRechazadas(7).length, 1);
assert.equal(rechazada.marca.local.nombre, "Local 1");
assert.equal(rechazada.motivo, "Estás fuera del radio permitido de 100 m");
assert.ok(!Number.isNaN(Date.parse(rechazada.rechazadaEn)), "guarda cuándo se rechazó");
assert.deepEqual(leerMarcasRechazadas(8), [], "las rechazadas también son por cuenta");

// "Entendido" la saca; las de otra cuenta no se tocan.
almacen.set("comercia.marcas-rechazadas.8", JSON.stringify([rechazada]));
descartarMarcaRechazada(7, "b");
assert.deepEqual(leerMarcasRechazadas(7), []);
assert.equal(leerMarcasRechazadas(8).length, 1);
console.log("Marcas sin conexión: guardado único, orden, cortes, rechazadas y descarte OK.");
