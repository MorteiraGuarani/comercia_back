import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { IDBFactory } from "fake-indexeddb";

const fuente = readFileSync(new URL("../src/lib/pendientes-tareas.ts", import.meta.url), "utf8");
const js = ts.transpileModule(fuente, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
class ApiError extends Error {
  constructor(status, mensaje) { super(mensaje); this.status = status; }
}
const indexedDB = new IDBFactory();
const navigator = { onLine: false };
let usuarioActual = 8;
let rechazar = null;
let motivo = "Visita cerrada";
let perderRespuesta = false;
const recibidas = new Map();
const intentos = [];
async function apiFetch(ruta, opciones) {
  if (ruta === "/auth/me") return { usuario: { id: usuarioActual } };
  const id = opciones.body instanceof FormData
    ? opciones.body.get("operacionId") : JSON.parse(opciones.body).operacionId;
  intentos.push(id);
  if (ruta === rechazar) throw new ApiError(403, motivo);
  recibidas.set(id, ruta);
  if (perderRespuesta) { perderRespuesta = false; throw new ApiError(0, "Sin respuesta"); }
  return { ok: true };
}
function cargarModulo() {
  const modulo = { exports: {} };
  vm.runInNewContext(js, {
    module: modulo, exports: modulo.exports,
    require: () => ({ apiFetch, ApiError }), indexedDB, navigator,
    window: new EventTarget(), Event, Blob, File, FormData, crypto, Error,
    // Acciones sucesivas con el mismo reloj conservan el orden de insercion.
    Date: class extends Date { static now() { return 1000; } },
  });
  return modulo.exports;
}
let lib = cargarModulo();
const ruta = "/campo/jornada/visitas/1/tareas/2";
const comentario = await lib.enviarAccionTarea(8, ruta + "/comentarios", "Comentario", { comentario: "Texto" });
const form = new FormData();
form.set("momento", "ANTES");
form.set("foto", new File(["foto-original"], "foto.jpg", { type: "image/jpeg" }));
const foto = await lib.enviarAccionTarea(8, ruta + "/fotos", "Foto", form);
const completar = await lib.enviarAccionTarea(8, ruta, "Completar");
assert.equal(foto.pendiente, true);
assert.equal(intentos.length, 0);
assert.deepEqual(Array.from(await lib.listarPendientes(8), (a) => a.id), [comentario.id, foto.id, completar.id]);
assert.equal((await lib.listarPendientes(9)).length, 0);
await lib.guardarBorrador(8, "comentario:1:2", "Borrador conservado");
lib = cargarModulo();
assert.equal(await lib.leerBorrador(8, "comentario:1:2"), "Borrador conservado");
assert.equal(await lib.leerBorrador(9, "comentario:1:2"), "");
const fotoGuardada = (await lib.listarPendientes(8))[1].campos.find((c) => c.nombre === "foto").valor;
assert.equal(await fotoGuardada.text(), "foto-original");
navigator.onLine = true;
usuarioActual = 9;
await assert.rejects(lib.sincronizarPendientes(8), /cuenta propietaria/);
assert.equal(intentos.length, 0);
usuarioActual = 8;
perderRespuesta = true;
await lib.sincronizarPendientes(8);
assert.equal((await lib.listarPendientes(8)).length, 3);
await lib.sincronizarPendientes(8);
assert.equal((await lib.listarPendientes(8)).length, 0);
assert.equal(intentos[0], intentos[1], "El reintento conserva el identificador para deduplicar en el servidor");
assert.equal(recibidas.size, 3);
navigator.onLine = false;
await lib.enviarAccionTarea(8, ruta + "/comentarios", "Comentario rechazado", { comentario: "Revisar" });
await lib.enviarAccionTarea(8, ruta, "Completar bloqueada");
const otra = await lib.enviarAccionTarea(8, "/campo/jornada/visitas/1/tareas/3/iniciar", "Otra tarea");
rechazar = ruta + "/comentarios";
navigator.onLine = true;
await lib.sincronizarPendientes(8);
const pendientes = await lib.listarPendientes(8);
assert.equal(pendientes.length, 2);
assert.equal(pendientes[0].estado, "REVISAR");
assert.equal(pendientes[1].estado, "PENDIENTE");
assert.equal(recibidas.has(otra.id), true, "La revision bloquea solo la tarea afectada");
rechazar = null;
await lib.reintentarPendientes(8);
assert.equal((await lib.listarPendientes(8)).length, 0);
// Con señal, un rechazo de la API muestra su motivo: no queda "guardado en el dispositivo".
rechazar = ruta;
motivo = "Debes subir foto antes y después para completar esta tarea";
await assert.rejects(lib.enviarAccionTarea(8, ruta, "Terminar tarea"), /Debes subir foto/);
assert.equal((await lib.listarPendientes(8)).length, 0, "El rechazo no queda en la cola");
// Una acción frenada por otra rechazada de la misma tarea también avisa el motivo.
navigator.onLine = false;
await lib.enviarAccionTarea(8, ruta + "/comentarios", "Comentario malo", { comentario: "x" });
navigator.onLine = true;
rechazar = ruta + "/comentarios";
motivo = "Visita cerrada";
await lib.sincronizarPendientes(8);
rechazar = null;
await assert.rejects(lib.enviarAccionTarea(8, ruta, "Terminar tarea"), /Primero resolvé «Comentario malo».*Visita cerrada/);
assert.deepEqual(Array.from(await lib.listarPendientes(8), (a) => a.estado), ["REVISAR"]);
// Repetir la acción rechazada la reemplaza y se envía.
const repetida = await lib.enviarAccionTarea(8, ruta + "/comentarios", "Comentario malo", { comentario: "x" });
assert.equal(repetida.pendiente, false);
assert.equal((await lib.listarPendientes(8)).length, 0);
console.log("OK: persistencia de fotos y borradores, orden, aislamiento de cuentas, reintentos sin falsa confirmacion y rechazos con su motivo.");
