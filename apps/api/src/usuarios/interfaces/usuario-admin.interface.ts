import type { DatosErpUsuario } from './datos-erp-usuario.interface';

export interface UsuarioAdminDto extends DatosErpUsuario {
  id: number;
  nombre: string;
  apellido: string;
  correo: string;
  nombreLogin: string;
  ruc: string | null;
  celular: string;
  legajo: string | null;
  /** Name de tbl_jcanales / tbl_oclp para mostrar lo elegido. */
  canalVentaNombre: string | null;
  sucursalNombre: string | null;
  empresa: { id: number; nombre: string };
  rol: { id: number; descripcion: string } | null;
  superior: { id: number; nombre: string } | null;
  esSuperadmin: boolean;
  isActive: boolean;
  /** Copia de sus programas de Ucheck (códigos). */
  programasUcheck: string[];
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
