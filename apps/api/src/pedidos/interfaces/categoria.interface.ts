/** Fila de campo_categoria tal como la devuelve la API. */
export interface Categoria {
  id: number;
  nombre_categoria: string;
  codesap: number | null;
  Modo: string | null;
  orden: number;
}
