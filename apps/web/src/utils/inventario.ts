// Reglas puras del inventario sin conexión.
import type { ItemInventario } from "@/types/inventario";
import { formatearPrecio } from "@/utils/precio-producto";

function claveDia(instante: number): string {
  const fecha = new Date(instante);
  return `${fecha.getFullYear()}-${fecha.getMonth()}-${fecha.getDate()}`;
}

// El catálogo se renueva al menos una vez por día calendario del equipo:
// una copia de ayer a las 23:00 se actualiza a la mañana siguiente.
export function catalogoDesactualizado(
  sincronizadoEn: number | undefined,
  ahora: number,
): boolean {
  return sincronizadoEn === undefined || claveDia(sincronizadoEn) !== claveDia(ahora);
}

// Clave de orden local: código y luego lista de precios. pricelist es SMALLINT
// (puede ser negativo): se desplaza a 0..65535 para ordenar como texto.
export function ordenItemInventario(item: Pick<ItemInventario, "itemcode" | "pricelist">): string {
  return `${item.itemcode}\u0000${String(item.pricelist + 32768).padStart(5, "0")}`;
}

// Todas las palabras escritas deben aparecer en el código, nombre o lista.
export function coincideBusqueda(busqueda: string, palabras: string[]): boolean {
  return palabras.every((palabra) => busqueda.includes(palabra));
}

export function nombreListaPrecio(item: Pick<ItemInventario, "pricelist" | "pricelistname">): string {
  return item.pricelistname?.trim() || `Lista ${item.pricelist}`;
}

// "Minorista · 25.000" o "Lista 2 · Sin precio".
export function detalleListaPrecio(item: Pick<ItemInventario, "pricelist" | "pricelistname" | "price">): string {
  return `${nombreListaPrecio(item)} · ${item.price === null ? "Sin precio" : formatearPrecio(item.price)}`;
}
