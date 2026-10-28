import type { ProductoFila } from '../interfaces/producto.interface';
import { Decimal } from '@prisma/client/runtime/client';
import { esIdBigint } from '../../common/utils/identificadores';
import type { Prisma } from '../../../generated/prisma/client';
import { ARTICULO_SELECT } from './selectores';
export function productoRespuesta(
  fila: ProductoFila,
  nombres: ReadonlyMap<number, string | null> = new Map(),
  p: Prisma.ProductoGetPayload<{
    select: typeof ARTICULO_SELECT;
  }> | null = null,
) {
  return {
    id: fila.id.toString(),
    itemcode: fila.itemcode,
    itemname: p?.itemname ?? null,
    iva: p?.iva ?? null,
    itmsgrpcode: p?.itmsgrpcode ?? null,
    itmsgrpnam: null,
    inventory: p?.inventory ?? null,
    pricelist: fila.pricelist,
    pricelistname: nombres.get(fila.pricelist) ?? null,
    price: fila.price?.toFixed(6) ?? null,
    tipo: p?.tipo ?? null,
  };
}
export function esIdProducto(value: unknown): boolean {
  return esIdBigint(value);
}
export function esPrecioProducto(value: unknown): boolean {
  if (typeof value === 'string')
    return /^-?(?:0|[1-9]\d{0,14})(?:\.\d{1,6})?$/.test(value);
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Math.abs(value) < 1e15 &&
    new Decimal(value).decimalPlaces() <= 6
  );
}
