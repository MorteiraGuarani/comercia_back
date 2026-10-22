/** Producto de un local en la copia sin conexión, con la carga de hoy. */
export interface ItemCopiaInventario {
  itemcode: string;
  itemname: string;
  cantidad: number | null;
  /** YYYY-MM-DD */
  vencimiento: string | null;
}
