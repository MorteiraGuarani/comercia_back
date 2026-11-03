/** Producto de OITM para cargar en una línea del pedido. */
export interface ProductoPedido {
  /** Igual a itemCode: lo usa el buscador (selector) de la web. */
  id: string;
  itemCode: string;
  nombre: string;
  /** Código y precio para mostrar en el buscador. */
  descripcion: string;
  /** Precio de tbl_itm1 en la lista del cliente; null si no tiene. */
  precio: number | null;
}
