import type { SelectorArticulo } from '../interfaces/selector-articulo.interface';

/** Identifica la fila de OSCN usando la clave original además de CardCode. */
export function leerSelectorArticulo(valor: unknown): SelectorArticulo | null {
  if (typeof valor !== 'string') return null;
  try {
    const datos: unknown = JSON.parse(valor);
    if (!datos || typeof datos !== 'object' || Array.isArray(datos))
      return null;
    const objeto = datos as Record<string, unknown>;
    if (
      Object.keys(objeto).length !== 2 ||
      typeof objeto.ItemCode !== 'string' ||
      objeto.ItemCode.length < 1 ||
      objeto.ItemCode.length > 100 ||
      typeof objeto.Substitute !== 'string' ||
      objeto.Substitute.length < 1 ||
      objeto.Substitute.length > 200
    )
      return null;
    return { ItemCode: objeto.ItemCode, Substitute: objeto.Substitute };
  } catch {
    return null;
  }
}
