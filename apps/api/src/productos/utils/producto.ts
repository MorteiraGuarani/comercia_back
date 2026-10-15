import type { ProductoFila } from '../interfaces/producto.interface';

export function productoRespuesta(fila: ProductoFila) {
  return {
    ...fila,
    id: fila.id.toString(),
    price: fila.price?.toFixed(6) ?? null,
  };
}

export function esIdProducto(value: unknown): boolean {
  return (
    typeof value === 'string' &&
    /^[1-9]\d{0,18}$/.test(value) &&
    BigInt(value) <= 9223372036854775807n
  );
}
