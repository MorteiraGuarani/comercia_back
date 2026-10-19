"use client";
import Dexie, { type Table } from "dexie";
import { apiFetch } from "./api";
import type { RespuestaPaginada } from "@/types/paginacion";
import type {
  CatalogoInventarioLocal,
  CatalogoInventarioRemoto,
  ItemInventario,
  ItemInventarioElegido,
  ItemInventarioLocal,
} from "@/types/inventario";
import { normalizarBusqueda } from "@/utils/texto";
import { coincideBusqueda, ordenItemInventario } from "@/utils/inventario";

class BaseInventario extends Dexie {
  articulos!: Table<ItemInventarioLocal, [number, string]>;
  seleccion!: Table<ItemInventarioElegido, [number, string]>;
  catalogos!: Table<CatalogoInventarioLocal, number>;

  constructor() {
    super("comercia-inventario");
    this.version(1).stores({
      items: "[empresaId+itemcode], empresaId",
      elegidos: "[usuarioId+itemcode], [usuarioId+agregadoEn]",
      catalogos: "empresaId",
    });
    // v2: una fila por artículo y lista de precios (clave: id de tbl_itm1).
    // La clave cambia, así que se recrean las tablas y se fuerza otra descarga.
    this.version(2)
      .stores({
        items: null,
        elegidos: null,
        articulos: "[empresaId+id], [empresaId+orden]",
        seleccion: "[usuarioId+id], [usuarioId+agregadoEn]",
        catalogos: "empresaId",
      })
      .upgrade((tx) => tx.table("catalogos").clear());
  }
}

// Se abre recién al usarla: el módulo nunca toca IndexedDB en el servidor.
let base: BaseInventario | null = null;
function db() {
  base ??= new BaseInventario();
  return base;
}

function paginar<T>(items: T[], total: number, page: number, limit: number): RespuestaPaginada<T> {
  return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

export async function leerCatalogo(empresaId: number): Promise<CatalogoInventarioLocal | null> {
  return (await db().catalogos.get(empresaId)) ?? null;
}

const enCurso = new Map<number, Promise<CatalogoInventarioLocal>>();

// Descarga el catálogo completo en un pedido y recién entonces reemplaza la
// copia local en una transacción: si la descarga falla, la anterior sigue intacta.
export function sincronizarCatalogo(empresaId: number): Promise<CatalogoInventarioLocal> {
  const actual = enCurso.get(empresaId);
  if (actual) return actual;
  const tarea = (async () => {
    const respuesta = await apiFetch<CatalogoInventarioRemoto>("/campo/inventario/items");
    const filas = new Map<string, ItemInventario>();
    for (const item of respuesta.items) filas.set(item.id, item);
    const catalogo: CatalogoInventarioLocal = {
      empresaId,
      sincronizadoEn: Date.now(),
      total: filas.size,
      articulos: new Set([...filas.values()].map((item) => item.itemcode)).size,
    };
    const base = db();
    await base.transaction("rw", base.articulos, base.catalogos, async () => {
      await base.articulos
        .where("[empresaId+id]")
        .between([empresaId, Dexie.minKey], [empresaId, Dexie.maxKey])
        .delete();
      await base.articulos.bulkPut(
        [...filas.values()].map((item) => ({
          id: item.id,
          itemcode: item.itemcode,
          itemname: item.itemname,
          pricelist: item.pricelist,
          pricelistname: item.pricelistname,
          price: item.price,
          empresaId,
          busqueda: normalizarBusqueda(`${item.itemcode} ${item.itemname} ${item.pricelistname ?? ""}`),
          orden: ordenItemInventario(item),
        })),
      );
      await base.catalogos.put(catalogo);
    });
    return catalogo;
  })().finally(() => enCurso.delete(empresaId));
  enCurso.set(empresaId, tarea);
  return tarea;
}

// Búsqueda local para el selector, ordenada por código y lista de precios.
export async function buscarItems(
  empresaId: number,
  texto: string,
  page: number,
  limit: number,
): Promise<RespuestaPaginada<ItemInventarioLocal>> {
  const palabras = normalizarBusqueda(texto).split(/\s+/).filter(Boolean);
  const coleccion = () =>
    db()
      .articulos.where("[empresaId+orden]")
      .between([empresaId, Dexie.minKey], [empresaId, Dexie.maxKey])
      .filter((item) => coincideBusqueda(item.busqueda, palabras));
  const total = await coleccion().count();
  const items = await coleccion().offset((page - 1) * limit).limit(limit).toArray();
  return paginar(items, total, page, limit);
}

// Elegidos del usuario, los últimos agregados primero. Si se quitó el último
// de una página, devuelve la última página que todavía tiene artículos.
export async function listarElegidos(
  usuarioId: number,
  empresaId: number,
  page: number,
  limit: number,
): Promise<RespuestaPaginada<ItemInventarioElegido>> {
  const coleccion = () =>
    db()
      .seleccion.where("[usuarioId+agregadoEn]")
      .between([usuarioId, Dexie.minKey], [usuarioId, Dexie.maxKey])
      .reverse()
      .filter((item) => item.empresaId === empresaId);
  const total = await coleccion().count();
  const vigente = Math.min(page, Math.max(1, Math.ceil(total / limit)));
  const items = await coleccion().offset((vigente - 1) * limit).limit(limit).toArray();
  return paginar(items, total, vigente, limit);
}

// ids (artículo + lista) que el usuario ya eligió.
export async function idsElegidos(usuarioId: number, empresaId: number): Promise<Set<string>> {
  const elegidos = await db()
    .seleccion.where("[usuarioId+id]")
    .between([usuarioId, Dexie.minKey], [usuarioId, Dexie.maxKey])
    .filter((item) => item.empresaId === empresaId)
    .toArray();
  return new Set(elegidos.map((item) => item.id));
}

export async function agregarElegido(usuarioId: number, empresaId: number, item: ItemInventario) {
  const base = db();
  await base.transaction("rw", base.seleccion, async () => {
    if (await base.seleccion.get([usuarioId, item.id])) return;
    await base.seleccion.add({
      id: item.id,
      itemcode: item.itemcode,
      itemname: item.itemname,
      pricelist: item.pricelist,
      pricelistname: item.pricelistname,
      price: item.price,
      usuarioId,
      empresaId,
      agregadoEn: Date.now(),
    });
  });
}

export async function quitarElegido(usuarioId: number, id: string) {
  await db().seleccion.delete([usuarioId, id]);
}
