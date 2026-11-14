/** Fila de campo_categoria tal como la devuelve la API. */
export interface Categoria {
  id: number;
  nombre_categoria: string;
  /** tbl_oitb.Number de la empresa. */
  ItemGroupCode: number | null;
  /** tbl_oitb.GroupName del grupo; null si no tiene grupo o no está en OITB. */
  grupo: string | null;
  Modo: string | null;
  orden: number;
}

/** Opción de grupo de OITB para el selector. */
export interface GrupoOitb {
  id: number;
  nombre: string;
  descripcion: string;
}
