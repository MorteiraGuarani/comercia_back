import type { ItemInventario } from '../interfaces/item-inventario.interface';

export const SELECT_ITEM_INVENTARIO = {
  id: true,
  itemcode: true,
  producto: { select: { itemname: true } },
  pricelist: true,
  price: true,
} as const;

// DTO mínimo: sin IVA, grupo ni otros campos internos de tbl_itm1.
export function aItemInventario(
  fila: {
    id: bigint;
    itemcode: string;
    producto: { itemname: string | null };
    pricelist: number;
    price: { toFixed(digitos: number): string } | null;
  },
  pricelistname: string | null = null,
): ItemInventario {
  return {
    id: fila.id.toString(),
    itemcode: fila.itemcode,
    itemname: fila.producto.itemname ?? fila.itemcode,
    pricelist: fila.pricelist,
    pricelistname,
    price: fila.price?.toFixed(6) ?? null,
  };
}
