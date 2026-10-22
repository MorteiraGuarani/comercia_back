"use client";
import Dexie, { type Table } from "dexie";
import { apiFetch, ApiError } from "./api";
import type { RespuestaPaginada } from "@/types/paginacion";
import type {
  CambioInventario,
  CopiaGuardada,
  CopiaInventarioRemota,
  LocalGuardado,
  PendienteInventario,
  ProductoGuardado,
} from "@/types/inventario";
import { normalizarBusqueda } from "@/utils/texto";
import { mensajeError } from "@/utils/error";
import { aplicarCambio, coincideBusqueda, necesitaSincronizar } from "@/utils/inventario";

const MAX_PENDIENTES = 200;

class BaseInventario extends Dexie {
  productos!: Table<ProductoGuardado, [number, string]>;
  locales!: Table<LocalGuardado, [number, string]>;
  copias!: Table<CopiaGuardada, number>;
  pendientes!: Table<PendienteInventario, string>;

  constructor() {
    super("comercia-inventario");
    // v3: productos de tbl_oitm y locales de la ruta por usuario, más la cola
    // de cambios sin enviar. Reemplaza el catálogo de precios de v1/v2.
    this.version(3).stores({
      items: null,
      elegidos: null,
      articulos: null,
      seleccion: null,
      catalogos: null,
      productos: "[usuarioId+itemcode], [usuarioId+orden]",
      locales: "[usuarioId+id]",
      copias: "usuarioId",
      pendientes: "id, [usuarioId+creadoEn]",
    });
  }
}

// Se abre recién al usarla: el módulo nunca toca IndexedDB en el servidor.
let base: BaseInventario | null = null;
function db() {
  base ??= new BaseInventario();
  return base;
}

const delUsuario = (usuarioId: number) =>
  [
    [usuarioId, Dexie.minKey],
    [usuarioId, Dexie.maxKey],
  ] as const;

const palabrasDe = (texto: string) => normalizarBusqueda(texto).split(/\s+/).filter(Boolean);

function paginar<T>(items: T[], total: number, page: number, limit: number): RespuestaPaginada<T> {
  return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

export async function leerCopia(usuarioId: number): Promise<CopiaGuardada | null> {
  return (await db().copias.get(usuarioId)) ?? null;
}

/** Cambios sin enviar del usuario, en el orden en que se hicieron. */
export function listarPendientes(usuarioId: number): Promise<PendienteInventario[]> {
  return db()
    .pendientes.where("[usuarioId+creadoEn]")
    .between(...delUsuario(usuarioId))
    .toArray();
}

const descargas = new Map<number, Promise<CopiaGuardada>>();

// Descarga todo en un pedido y recién entonces reemplaza la copia en una
// transacción: si falla, la anterior sigue intacta. Los cambios que todavía no
// llegaron al servidor se vuelven a aplicar encima de lo descargado.
export function descargarCopia(usuarioId: number): Promise<CopiaGuardada> {
  const actual = descargas.get(usuarioId);
  if (actual) return actual;
  const tarea = (async () => {
    const r = await apiFetch<CopiaInventarioRemota>("/campo/inventario/copia");
    if (r.usuarioId !== usuarioId)
      throw new Error("La sesión abierta es de otra cuenta. Volvé a ingresar.");
    const copia: CopiaGuardada = {
      usuarioId,
      sincronizadoEn: Date.now(),
      hoy: r.hoy,
      diasAviso: r.diasAviso,
      productos: r.productos.length,
      locales: r.locales.length,
    };
    const b = db();
    await b.transaction("rw", [b.productos, b.locales, b.copias, b.pendientes], async () => {
      await b.productos.where("[usuarioId+itemcode]").between(...delUsuario(usuarioId)).delete();
      await b.productos.bulkPut(
        r.productos.map((p) => ({
          usuarioId,
          itemcode: p.itemcode,
          itemname: p.itemname,
          busqueda: normalizarBusqueda(`${p.itemcode} ${p.itemname}`),
          orden: `${normalizarBusqueda(p.itemname)}\u0000${p.itemcode}`,
        })),
      );
      const pendientes = await listarPendientes(usuarioId);
      await b.locales.where("[usuarioId+id]").between(...delUsuario(usuarioId)).delete();
      await b.locales.bulkPut(
        r.locales.map((l) =>
          pendientes
            .filter((p) => p.localId === l.id)
            .reduce<LocalGuardado>(aplicarCambio, {
              usuarioId,
              id: l.id,
              nombre: l.nombre,
              direccion: l.direccion,
              fechas: l.fechas,
              busqueda: normalizarBusqueda(`${l.nombre} ${l.id} ${l.direccion}`),
              items: l.items.map((i) => ({ ...i, fecha: i.cantidad === null ? null : r.hoy })),
            }),
        ),
      );
      await b.copias.put(copia);
    });
    return copia;
  })().finally(() => descargas.delete(usuarioId));
  descargas.set(usuarioId, tarea);
  return tarea;
}

/** Productos guardados para el selector, por nombre. */
export async function buscarProductos(
  usuarioId: number,
  texto: string,
  page: number,
  limit: number,
): Promise<RespuestaPaginada<ProductoGuardado>> {
  const palabras = palabrasDe(texto);
  const coleccion = () =>
    db()
      .productos.where("[usuarioId+orden]")
      .between(...delUsuario(usuarioId))
      .filter((p) => coincideBusqueda(p.busqueda, palabras));
  const total = await coleccion().count();
  const items = await coleccion()
    .offset((page - 1) * limit)
    .limit(limit)
    .toArray();
  return paginar(items, total, page, limit);
}

/** Locales guardados, por nombre. Son pocos: se ordenan en memoria. */
export async function listarLocales(
  usuarioId: number,
  texto: string,
  page: number,
  limit: number,
): Promise<RespuestaPaginada<LocalGuardado>> {
  const palabras = palabrasDe(texto);
  const todos = (await db().locales.where("[usuarioId+id]").between(...delUsuario(usuarioId)).toArray())
    .filter((l) => coincideBusqueda(l.busqueda, palabras))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es") || a.id.localeCompare(b.id));
  // Si una descarga dejó menos locales, se muestra la última página que tiene.
  const vigente = Math.min(page, Math.max(1, Math.ceil(todos.length / limit)));
  return paginar(todos.slice((vigente - 1) * limit, vigente * limit), todos.length, vigente, limit);
}

export async function leerLocal(usuarioId: number, localId: string): Promise<LocalGuardado | null> {
  return (await db().locales.get([usuarioId, localId])) ?? null;
}

// El cambio queda en el equipo (cola y copia del local) en una sola transacción:
// se ve enseguida y se envía cuando haya conexión.
export async function guardarCambios(usuarioId: number, localId: string, cambios: CambioInventario[]) {
  const b = db();
  await b.transaction("rw", b.pendientes, b.locales, async () => {
    const actuales = await listarPendientes(usuarioId);
    if (actuales.length + cambios.length > MAX_PENDIENTES)
      throw new Error(
        `Tenés ${actuales.length} cambios sin enviar. Conectate para enviarlos antes de seguir cargando.`,
      );
    let local = await b.locales.get([usuarioId, localId]);
    if (!local) throw new Error("Este local ya no está guardado en el equipo");
    let creadoEn = Math.max(Date.now(), ...actuales.map((a) => a.creadoEn + 1));
    for (const cambio of cambios) {
      await b.pendientes.add({
        ...cambio,
        id: `${creadoEn}-${Math.random().toString(36).slice(2)}`,
        usuarioId,
        localId,
        localNombre: local.nombre,
        creadoEn: creadoEn++,
        estado: "PENDIENTE",
        error: null,
      });
      local = aplicarCambio(local, cambio);
    }
    await b.locales.put(local);
  });
}

function enviar(p: PendienteInventario) {
  const ruta = `/campo/inventario/locales/${encodeURIComponent(p.localId)}`;
  if (p.tipo === "agregar")
    return apiFetch(`${ruta}/productos`, {
      method: "POST",
      body: JSON.stringify({ itemcodes: [p.itemcode] }),
    });
  if (p.tipo === "quitar")
    return apiFetch(`${ruta}/productos/${encodeURIComponent(p.itemcode)}`, { method: "DELETE" });
  return apiFetch(`${ruta}/cargas`, {
    method: "PUT",
    body: JSON.stringify({ fecha: p.fecha, cargas: p.cargas }),
  });
}

const envios = new Map<number, Promise<void>>();

// Envía en orden. Sin señal o con el servidor caído se corta y reintenta después;
// un rechazo del servidor queda «para revisar» y frena los siguientes cambios de
// ese local para no aplicarlos fuera de orden.
export function enviarPendientes(usuarioId: number): Promise<void> {
  const actual = envios.get(usuarioId);
  if (actual) return actual;
  const tarea = (async () => {
    if (!navigator.onLine) return;
    const pendientes = await listarPendientes(usuarioId);
    if (!pendientes.some((p) => p.estado === "PENDIENTE")) return;
    // Nunca se envían los cambios de un usuario con la sesión de otro.
    const sesion = await apiFetch<{ usuario: { id: number } }>("/auth/me");
    if (sesion.usuario.id !== usuarioId)
      throw new Error("Ingresá con la cuenta que hizo estos cambios para enviarlos");
    const frenados = new Set<string>();
    for (const p of pendientes) {
      if (p.estado === "REVISAR" || frenados.has(p.localId)) {
        frenados.add(p.localId);
        continue;
      }
      try {
        await enviar(p);
        await db().pendientes.delete(p.id);
      } catch (e) {
        // Quitar algo que ya no estaba en el local deja el mismo resultado.
        if (p.tipo === "quitar" && e instanceof ApiError && e.status === 404) {
          await db().pendientes.delete(p.id);
          continue;
        }
        const rechazado =
          e instanceof ApiError && e.status >= 400 && e.status < 500 && ![401, 408, 429].includes(e.status);
        await db().pendientes.put({
          ...p,
          estado: rechazado ? "REVISAR" : "PENDIENTE",
          error: mensajeError(e, "No se pudo enviar el cambio"),
        });
        if (!rechazado) break;
        frenados.add(p.localId);
      }
    }
  })().finally(() => envios.delete(usuarioId));
  envios.set(usuarioId, tarea);
  return tarea;
}

export async function reintentarPendientes(usuarioId: number) {
  const revisar = (await listarPendientes(usuarioId)).filter((p) => p.estado === "REVISAR");
  await db().pendientes.bulkPut(revisar.map((p) => ({ ...p, estado: "PENDIENTE" as const, error: null })));
  await enviarPendientes(usuarioId);
}

/** Lo descartado ya está aplicado en la copia: se corrige con la próxima descarga. */
export async function descartarPendiente(usuarioId: number, id: string) {
  const p = await db().pendientes.get(id);
  if (p?.usuarioId === usuarioId) await db().pendientes.delete(id);
}

/** Envía lo pendiente y descarga si toca (primera conexión del día y mediodía). */
export async function sincronizarInventario(usuarioId: number, forzar = false) {
  if (!navigator.onLine) return;
  await enviarPendientes(usuarioId);
  if (forzar || necesitaSincronizar((await leerCopia(usuarioId))?.sincronizadoEn, Date.now()))
    await descargarCopia(usuarioId);
}
