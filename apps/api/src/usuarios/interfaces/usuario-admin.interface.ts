export interface UsuarioAdminDto {
  id: number;
  nombre: string;
  apellido: string;
  correo: string;
  nombreLogin: string;
  ruc: string;
  celular: string;
  legajo: string | null;
  empresa: { id: number; nombre: string };
  rol: { id: number; descripcion: string } | null;
  superior: { id: number; nombre: string } | null;
  esSuperadmin: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface MetaUsuariosDto {
  empresas: { id: number; nombre: string }[];
  esSuperadmin: boolean;
}

export interface UsuarioLocalAsignacionDto {
  id: number;
  /** CardCode del socio de negocio (tbl_ocrd). */
  localId: string;
  nombreLocal: string;
  fechaDesde: string;
  fechaHasta: string | null;
}
