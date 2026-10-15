export const PRODUCTO_SELECT = {
  id: true,
  itemcode: true,
  itemname: true,
  iva: true,
  itmsgrpcode: true,
  itmsgrpnam: true,
  inventory: true,
  pricelist: true,
  pricelistname: true,
  price: true,
  tipo: true,
} as const;

export const PRECIO_ESPECIAL_SELECT = {
  id: true,
  cardCode: true,
  cardName: true,
  cardType: true,
  listPriceName: true,
  listPriceCod: true,
  itemCode: true,
  itemName: true,
  price: true,
  um: true,
  itmsGrpCode: true,
  itmsGrpNam: true,
  valid: true,
} as const;

export const PRECIO_ESPECIAL_DETALLE_SELECT = {
  id: true,
  itemCode: true,
  cardCode: true,
  lineNum: true,
  price: true,
  currency: true,
  discount: true,
  listNum: true,
  fromDate: true,
  toDate: true,
} as const;
