// Reglas puras del inventario sin conexión.
import type { CambioInventario, CargaInventario, EdicionInventario, LocalGuardado } from "@/types/inventario";

const dos = (n: number) => String(n).padStart(2, "0");

/** YYYY-MM-DD según el reloj del equipo. */
export function hoyEquipo(ahora = new Date()): string {
  return `${ahora.getFullYear()}-${dos(ahora.getMonth() + 1)}-${dos(ahora.getDate())}`;
}

/**
 * Se descarga en la primera conexión del día y otra vez desde el mediodía:
 * una copia de las 8:00 se renueva después de las 12:00, una de las 12:30 no.
 */
export function necesitaSincronizar(sincronizadoEn: number | undefined, ahora: number): boolean {
  if (sincronizadoEn === undefined) return true;
  const antes = new Date(sincronizadoEn);
  const ya = new Date(ahora);
  if (hoyEquipo(antes) !== hoyEquipo(ya)) return true;
  return ya.getHours() >= 12 && antes.getHours() < 12;
}

/** Negativo si ya venció. */
export function diasParaVencer(vencimiento: string, hoy: string): number {
  return Math.round((Date.parse(`${vencimiento}T00:00:00Z`) - Date.parse(`${hoy}T00:00:00Z`)) / 86_400_000);
}

// Todas las palabras escritas deben aparecer en el texto normalizado.
export function coincideBusqueda(busqueda: string, palabras: string[]): boolean {
  return palabras.every((palabra) => busqueda.includes(palabra));
}

/** Solo envía filas completas y válidas; las demás siguen en edición. */
export function prepararCargasInventario(ediciones: Record<string, EdicionInventario>) {
  const cargas: CargaInventario[] = [];
  const pendientes: Record<string, EdicionInventario> = {};
  for (const [itemcode, edicion] of Object.entries(ediciones)) {
    const cantidad = edicion.cantidad.trim();
    const fecha = Date.parse(`${edicion.vencimiento}T00:00:00Z`);
    const valida = /^\d+$/.test(cantidad) && Number(cantidad) <= 1_000_000 &&
      /^\d{4}-\d{2}-\d{2}$/.test(edicion.vencimiento) && Number.isFinite(fecha) &&
      new Date(fecha).toISOString().slice(0, 10) === edicion.vencimiento;
    if (valida) cargas.push({ itemcode, cantidad: Number(cantidad), vencimiento: edicion.vencimiento });
    else pendientes[itemcode] = edicion;
  }
  return { cargas, pendientes };
}

/** El local tal como queda después del cambio; no modifica el original. */
export function aplicarCambio(local: LocalGuardado, cambio: CambioInventario): LocalGuardado {
  if (cambio.tipo === "agregar")
    return local.items.some((i) => i.itemcode === cambio.itemcode)
      ? local
      : {
          ...local,
          items: [
            ...local.items,
            // El último agregado va al final, en el orden en que se cargan.
            { itemcode: cambio.itemcode, itemname: cambio.itemname, cantidad: null, vencimiento: null, fecha: null },
          ],
        };
  if (cambio.tipo === "quitar")
    return { ...local, items: local.items.filter((i) => i.itemcode !== cambio.itemcode) };
  const cargas = new Map(cambio.cargas.map((c) => [c.itemcode, c]));
  return {
    ...local,
    items: local.items.map((i) => {
      const c = cargas.get(i.itemcode);
      return c ? { ...i, cantidad: c.cantidad, vencimiento: c.vencimiento, fecha: cambio.fecha } : i;
    }),
  };
}
