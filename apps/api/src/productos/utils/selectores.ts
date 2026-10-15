export const PRODUCTO_SELECT = {
  cardCode: true,
  descripcion: true,
  iva: true,
  grupo: true,
  nombreGrupo: true,
  inventario: true,
  tipo: true,
  _count: { select: { precios: true } },
} as const;

export const PRECIO_SELECT = {
  id: true,
  cardCode: true,
  nroListaPrecio: true,
  listaPrecio: true,
  precio: true,
  producto: { select: { descripcion: true } },
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
