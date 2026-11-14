/** Fila de campo_categoria: las pestañas de productos del asistente de pedidos de una empresa. */
export interface Categoria {
  id: number;
  nombre_categoria: string;
  /** Grupo de artículos de SAP: tbl_oitb.Number (OITM.ItemsGroupCode). */
  ItemGroupCode: number | null;
  /** Nombre del grupo en OITB; null si no tiene grupo o no está en OITB. */
  grupo: string | null;
  /** I = pestaña propia en Pedidos; G (o vacío) = sus productos van en «Otros». */
  Modo: "I" | "G" | null;
  orden: number;
}
