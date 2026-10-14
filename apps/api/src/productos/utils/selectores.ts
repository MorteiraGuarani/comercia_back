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
