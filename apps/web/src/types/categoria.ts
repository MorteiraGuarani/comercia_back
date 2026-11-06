/** Fila de campo_categoria: los pasos del asistente de pedidos de una empresa. */
export interface Categoria {
  id: number;
  nombre_categoria: string;
  /** Grupo de artículos de SAP (OITB). */
  codesap: number | null;
  /** Un solo carácter. */
  Modo: string | null;
  orden: number;
}
