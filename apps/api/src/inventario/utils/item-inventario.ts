import type { ItemInventario } from '../interfaces/item-inventario.interface';

export const SELECT_ITEM_INVENTARIO = {
  id: true,
  itemcode: true,
  itemname: true,
  pricelist: true,
  pricelistname: true,
  price: true,
} as const;

// DTO mínimo: sin IVA, grupo ni otros campos internos de tbl_itm1.
export function aItemInventario(fila: {
  id: bigint;
  itemcode: string;
  itemname: string;
  pricelist: number;
  pricelistname: string | null;
  price: { toFixed(digitos: number): string } | null;
}): ItemInventario {
  return {
    id: fila.id.toString(),
    itemcode: fila.itemcode,
    itemname: fila.itemname,
    pricelist: fila.pricelist,
    pricelistname: fila.pricelistname,
    price: fila.price?.toFixed(6) ?? null,
  };
}
