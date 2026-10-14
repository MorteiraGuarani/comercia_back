import type { PrecioFila } from '../interfaces/precio.interface';

export function precioRespuesta(fila: PrecioFila) {
  return { ...fila, precio: fila.precio.toFixed(6) };
}
