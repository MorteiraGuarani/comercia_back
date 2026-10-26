import type { RespuestaPaginada } from "./paginacion";

/** Local de la ruta del usuario para elegir su inventario. */
export interface LocalInventario {
  id: string;
  nombre: string;
  direccion: string;
}

/** Producto del local con lo cargado en la fecha consultada. */
export interface ItemInventarioLocal {
  itemcode: string;
  itemname: string;
  cantidad: number | null;
  /** YYYY-MM-DD */
  vencimiento: string | null;
  /** Negativo si ya venció; null sin carga. */
  diasParaVencer: number | null;
}

/** GET /campo/inventario/locales/:CardCode */
export interface InventarioLocal extends RespuestaPaginada<ItemInventarioLocal> {
  local: { id: string; nombre: string };
  hoy: string;
  fecha: string;
  /** Solo hoy se carga; las fechas anteriores son de consulta. */
  editable: boolean;
  diasAviso: number;
  /** Fechas anteriores con carga, de la más reciente a la más vieja. */
  fechas: string[];
  productosTotal: number;
  cargadosHoy: number;
}

/** Producto de un local en la copia sin conexión, con la carga de hoy. */
export interface ItemCopiaInventario {
  itemcode: string;
  itemname: string;
  cantidad: number | null;
  /** YYYY-MM-DD */
  vencimiento: string | null;
}

/** GET /campo/inventario/copia: todo lo necesario para trabajar sin conexión. */
export interface CopiaInventarioRemota {
  /** Dueño de la sesión: la copia se guarda solo para ese usuario. */
  usuarioId: number;
  hoy: string;
  diasAviso: number;
  /** Local principal del usuario si está en su ruta: se abre directo. */
  localPrincipalId: string | null;
  /** inventario: QryInventario = 'Y', se precarga en todos los locales. */
  productos: { itemcode: string; itemname: string; inventario?: boolean }[];
  locales: (LocalInventario & {
    /** Días anteriores con carga (último mes), del más reciente al más viejo. */
    fechas: string[];
    items: ItemCopiaInventario[];
  })[];
}

/** Producto del catálogo guardado en este equipo (IndexedDB). */
export interface ProductoGuardado {
  usuarioId: number;
  itemcode: string;
  itemname: string;
  /** Código y nombre normalizados para buscar sin acentos ni mayúsculas. */
  busqueda: string;
  /** Nombre y código: ordena con un índice compuesto. */
  orden: string;
  /** QryInventario = 'Y': aparece precargado en el inventario de cada local. */
  inventario: boolean;
}

/** Producto de un local guardado; cantidad y vencimiento valen para `fecha`. */
export interface ItemGuardado extends ItemCopiaInventario {
  fecha: string | null;
}

/** Local de la ruta guardado en este equipo con sus productos. */
export interface LocalGuardado extends LocalInventario {
  usuarioId: number;
  busqueda: string;
  fechas: string[];
  items: ItemGuardado[];
}

/** Última descarga de la copia de un usuario en este equipo. */
export interface CopiaGuardada {
  usuarioId: number;
  sincronizadoEn: number;
  hoy: string;
  diasAviso: number;
  productos: number;
  locales: number;
  localPrincipalId: string | null;
}

export interface CargaInventario {
  itemcode: string;
  cantidad: number;
  /** YYYY-MM-DD */
  vencimiento: string;
}

/** Cambio hecho en el equipo, que se envía al servidor en orden. */
export type CambioInventario =
  | { tipo: "agregar"; itemcode: string; itemname: string }
  | { tipo: "quitar"; itemcode: string }
  | { tipo: "cargas"; fecha: string; cargas: CargaInventario[] };

export type PendienteInventario = CambioInventario & {
  id: string;
  usuarioId: number;
  localId: string;
  localNombre: string;
  creadoEn: number;
  /** REVISAR: el servidor lo rechazó; se reintenta o se descarta a mano. */
  estado: "PENDIENTE" | "REVISAR";
  error: string | null;
};
