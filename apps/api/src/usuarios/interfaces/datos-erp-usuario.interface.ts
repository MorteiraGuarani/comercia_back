/** Referencias ERP del usuario; no otorgan permisos ni cambian su jerarquía. */
export interface DatosErpUsuario {
  ERP_CanalVenta: string | null;
  ERP_Almacen: string | null;
  ERP_Supervisor: string | null;
  ERP_Vendedor: number | null;
  ERP_Repositor: string | null;
  ERP_Impulsador: string | null;
}
