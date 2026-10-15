import type { ProductoFila } from '../interfaces/producto.interface';
import { Decimal } from '@prisma/client/runtime/client';

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

export function esPrecioProducto(value: unknown): boolean {
  // Se documenta como número JSON. El texto decimal sigue siendo compatible
  // con el panel y las integraciones que conservan los 21 dígitos exactos.
  if (typeof value === 'string')
    return /^-?(?:0|[1-9]\d{0,14})(?:\.\d{1,6})?$/.test(value);
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Math.abs(value) < 1e15 &&
    new Decimal(value).decimalPlaces() <= 6
  );
}
