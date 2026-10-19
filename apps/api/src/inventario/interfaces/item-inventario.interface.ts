// Fila de tbl_itm1 (artículo en una lista de precios) tal como la consume el
// inventario del impulsador. id y price viajan como texto para no redondear.
export interface ItemInventario {
  id: string;
  itemcode: string;
  itemname: string;
  pricelist: number;
  pricelistname: string | null;
  price: string | null;
}

// Catálogo completo de la empresa, sin paginar (ver AGENTS.md).
export interface CatalogoInventario {
  items: ItemInventario[];
  total: number;
}
