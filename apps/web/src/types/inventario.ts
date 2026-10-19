// Fila de tbl_itm1 (artículo en una lista de precios) tal como la entrega
// /campo/inventario/items. id y price llegan como texto para no redondear.
export interface ItemInventario {
  id: string;
  itemcode: string;
  itemname: string;
  pricelist: number;
  pricelistname: string | null;
  price: string | null;
}

// Respuesta de /campo/inventario/items: el catálogo completo, sin paginar.
export interface CatalogoInventarioRemoto {
  items: ItemInventario[];
  total: number;
}

// Copia local (IndexedDB) del catálogo, separada por empresa.
export interface ItemInventarioLocal extends ItemInventario {
  empresaId: number;
  // Código, nombre y lista normalizados para buscar sin acentos ni mayúsculas.
  busqueda: string;
  // Código y lista: ordena el selector con un índice compuesto de dos partes.
  orden: string;
}

// Artículo y lista elegidos por el usuario. Se conserva en su navegador.
export interface ItemInventarioElegido extends ItemInventario {
  usuarioId: number;
  empresaId: number;
  agregadoEn: number;
}

// Última descarga completa del catálogo de una empresa en este navegador.
export interface CatalogoInventarioLocal {
  empresaId: number;
  sincronizadoEn: number;
  // Filas guardadas (artículo + lista) y artículos distintos.
  total: number;
  articulos: number;
}
