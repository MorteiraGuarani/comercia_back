/** Referencias ERP del usuario; no otorgan permisos ni cambian su jerarquía. */
export interface DatosErpUsuario {
  ERP_CanalVenta: string | null;
  ERP_Repositor: string | null;
  ERP_CodigoAlmacen: string | null;
  ERP_NombreAlmacen: string | null;
  ERP_CodUsuarioSap: string | null;
  /** Code de tbl_oclp de su empresa. */
  ERP_Sucursal: number | null;
}
