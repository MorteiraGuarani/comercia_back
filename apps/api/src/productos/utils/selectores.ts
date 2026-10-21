export const ARTICULO_SELECT = {
  itemcode: true,
  itemname: true,
  iva: true,
  itmsgrpcode: true,
  inventory: true,
  tipo: true,
  validFor: true,
  frozenFor: true,
} as const;
export const PRODUCTO_SELECT = {
  id: true,
  itemcode: true,
  pricelist: true,
  price: true,
  producto: { select: ARTICULO_SELECT },
} as const;
