"use client";
import { apiFetch, ApiError } from "./api";
import type {
  AccionTareaPendiente,
  ResultadoAccionTarea,
} from "@/types/pendientes-tareas";

const NOMBRE_DB = "comercia-tareas-pendientes";
const EVENTO = "comercia-pendientes-tareas";
let apertura: Promise<IDBDatabase> | null = null;
const enCurso = new Map<number, Promise<void>>();
const resultados = new Map<string, unknown>();
const esperandoRespuesta = new Set<string>();

function db() {
  if (!apertura)
    apertura = new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined") {
        reject(
          new Error("Este navegador no puede conservar tareas sin conexión"),
        );
        return;
      }
      const solicitud = indexedDB.open(NOMBRE_DB, 1);
      solicitud.onupgradeneeded = () => {
        const base = solicitud.result;
        const acciones = base.createObjectStore("acciones", { keyPath: "id" });
        acciones.createIndex("usuarioId", "usuarioId");
        const borradores = base.createObjectStore("borradores", {
          keyPath: "id",
        });
        borradores.createIndex("usuarioId", "usuarioId");
      };
      solicitud.onsuccess = () => resolve(solicitud.result);
      solicitud.onerror = () => {
        apertura = null;
        reject(new Error("No se pudo abrir el almacenamiento de pendientes"));
      };
    });
  return apertura;
}
async function escribir(store: string, valor: unknown, id?: string) {
  const base = await db();
  await new Promise<void>((resolve, reject) => {
    const tx = base.transaction(store, "readwrite");
    if (id) tx.objectStore(store).delete(id);
    else tx.objectStore(store).put(valor);
    tx.oncomplete = () => resolve();
    tx.onerror = () =>
      reject(
        new Error(
          "No se pudo conservar la acción. Revisá el espacio del teléfono",
        ),
      );
    tx.onabort = () => reject(new Error("No se pudo conservar la acción"));
  });
  window.dispatchEvent(new Event(EVENTO));
}
export async function listarPendientes(
  usuarioId: number,
): Promise<AccionTareaPendiente[]> {
  const base = await db();
  return new Promise((resolve, reject) => {
    const r = base
      .transaction("acciones")
      .objectStore("acciones")
      .index("usuarioId")
      .getAll(usuarioId);
    r.onsuccess = () =>
      resolve(
        (r.result as AccionTareaPendiente[]).sort(
          (a, b) => a.creadaEn - b.creadaEn || a.id.localeCompare(b.id),
        ),
      );
    r.onerror = () => reject(new Error("No se pudieron leer los pendientes"));
  });
}
export function observarPendientes(callback: () => void) {
  window.addEventListener(EVENTO, callback);
  return () => window.removeEventListener(EVENTO, callback);
}
export async function descartarPendiente(usuarioId: number, id: string) {
  const propias = await listarPendientes(usuarioId);
  if (propias.some((p) => p.id === id)) await escribir("acciones", null, id);
}
export async function reintentarPendientes(usuarioId: number) {
  for (const p of await listarPendientes(usuarioId))
    if (p.estado === "REVISAR")
      await escribir("acciones", { ...p, estado: "PENDIENTE", error: null });
  await sincronizarPendientes(usuarioId);
}

export function sincronizarPendientes(usuarioId: number): Promise<void> {
  const actual = enCurso.get(usuarioId);
  if (actual) return actual;
  const tarea = (async () => {
    if (!navigator.onLine) return;
    // Cada reenvío comprueba la identidad actual: nunca usa la sesión de otra cuenta.
    const sesion = await apiFetch<{ usuario: { id: number } }>("/auth/me");
    if (sesion.usuario.id !== usuarioId)
      throw new Error("Ingresá con la cuenta propietaria de estos pendientes");
    const bloqueadas = new Set<string>();
    for (const accion of await listarPendientes(usuarioId)) {
      const grupo =
        accion.ruta.match(
          /^\/campo\/jornada\/visitas\/\d+\/tareas\/\d+/,
        )?.[0] ?? accion.ruta;
      if (accion.estado === "REVISAR") {
        bloqueadas.add(grupo);
        continue;
      }
      if (bloqueadas.has(grupo)) continue;
      try {
        let cuerpo: BodyInit | undefined = accion.cuerpo ?? undefined;
        if (accion.campos) {
          const form = new FormData();
          for (const c of accion.campos) {
            if (c.valor instanceof Blob)
              form.append(c.nombre, c.valor, c.archivo ?? "foto.jpg");
            else form.append(c.nombre, c.valor);
          }
          cuerpo = form;
        }
        const resultado = await apiFetch<unknown>(accion.ruta, {
          method: "POST",
          body: cuerpo,
        });
        if (esperandoRespuesta.has(accion.id))
          resultados.set(accion.id, resultado);
        await escribir("acciones", null, accion.id);
      } catch (e) {
        const revisar =
          e instanceof ApiError &&
          e.status >= 400 &&
          e.status < 500 &&
          e.status !== 401 &&
          e.status !== 408 &&
          e.status !== 429;
        await escribir("acciones", {
          ...accion,
          estado: revisar ? "REVISAR" : "PENDIENTE",
          error: e instanceof Error ? e.message : "No se pudo enviar la acción",
        });
        if (!revisar) break;
        bloqueadas.add(grupo);
      }
    }
  })().finally(() => enCurso.delete(usuarioId));
  enCurso.set(usuarioId, tarea);
  return tarea;
}

export async function enviarAccionTarea<T>(
  usuarioId: number,
  ruta: string,
  etiqueta: string,
  cuerpo?: object | FormData,
): Promise<ResultadoAccionTarea<T>> {
  if (
    !/^\/campo\/jornada\/visitas\/\d+\/tareas\/\d+(?:\/iniciar|\/comentarios|\/fotos)?$/.test(
      ruta,
    )
  )
    throw new Error("Esta operación requiere conexión directa");
  const id = crypto.randomUUID();
  let campos: AccionTareaPendiente["campos"];
  let json: string | null = null;
  if (cuerpo instanceof FormData) {
    campos = [];
    for (const [nombre, valor] of cuerpo.entries())
      campos.push({
        nombre,
        valor,
        archivo: valor instanceof File ? valor.name : undefined,
      });
    campos.push({ nombre: "operacionId", valor: id });
  } else json = JSON.stringify({ ...cuerpo, operacionId: id });
  const actuales = await listarPendientes(usuarioId);
  if (actuales.length >= 100)
    throw new Error(
      "Tenés 100 acciones pendientes. Sincronizá o revisá antes de agregar más",
    );
  await escribir("acciones", {
    id,
    usuarioId,
    ruta,
    etiqueta,
    creadaEn: Math.max(Date.now(), ...actuales.map((a) => a.creadaEn + 1)),
    estado: "PENDIENTE",
    error: null,
    cuerpo: json,
    campos,
  } satisfies AccionTareaPendiente);
  esperandoRespuesta.add(id);
  await sincronizarPendientes(usuarioId).catch(() => undefined);
  const pendiente = (await listarPendientes(usuarioId)).some(
    (a) => a.id === id,
  );
  const resultado = resultados.get(id) as T | undefined;
  resultados.delete(id);
  esperandoRespuesta.delete(id);
  return { pendiente, resultado: resultado ?? null, id };
}

export async function guardarBorrador(
  usuarioId: number,
  id: string,
  texto: string,
) {
  await escribir("borradores", { id: `${usuarioId}:${id}`, usuarioId, texto });
}
export async function leerBorrador(
  usuarioId: number,
  id: string,
): Promise<string> {
  const base = await db();
  return new Promise((resolve, reject) => {
    const r = base
      .transaction("borradores")
      .objectStore("borradores")
      .get(`${usuarioId}:${id}`);
    r.onsuccess = () =>
      resolve((r.result as { texto?: string } | undefined)?.texto ?? "");
    r.onerror = () => reject(new Error("No se pudo recuperar el borrador"));
  });
}
