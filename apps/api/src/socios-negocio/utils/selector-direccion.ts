import type { SelectorDireccion } from '../interfaces/selector-direccion.interface';

/** JSON evita confundir NULL con la dirección cuyo texto literal es "null". */
export function leerSelectorDireccion(
  valor: unknown,
): SelectorDireccion | null {
  if (typeof valor !== 'string') return null;
  try {
    const objeto: unknown = JSON.parse(valor);
    if (!objeto || typeof objeto !== 'object' || Array.isArray(objeto))
      return null;
    const campos = ['Address', 'Street', 'AdresType'];
    const datos = objeto as Record<string, unknown>;
    if (
      Object.keys(datos).length !== campos.length ||
      campos.some(
        (c) =>
          !Object.hasOwn(datos, c) ||
          (datos[c] !== null &&
            (typeof datos[c] !== 'string' || datos[c].length > 200)),
      )
    )
      return null;
    return datos as unknown as SelectorDireccion;
  } catch {
    return null;
  }
}
