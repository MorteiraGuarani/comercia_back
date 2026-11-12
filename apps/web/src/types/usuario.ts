import type { CountryCode } from "libphonenumber-js";
import type { EquipoCampo } from "./rol";

/** Pestaña SAP: Codes de tbl_jcanales (como texto) y tbl_oclp de la empresa, más almacén y usuario SAP. */
export interface DatosErpUsuario {
  ERP_CanalVenta: string | null;
  ERP_Sucursal: number | null;
  ERP_CodigoAlmacen: string | null;
  ERP_NombreAlmacen: string | null;
  ERP_CodUsuarioSap: string | null;
}

export type FormularioErpUsuario = { [Campo in keyof DatosErpUsuario]: string };

export interface FormUsuario extends FormularioErpUsuario {
  nombre: string;
  apellido: string;
  correo: string;
  nombreLogin: string;
  ruc: string;
  celularPais: CountryCode;
  celular: string;
  legajo: string;
  password: string;
  rolId: number | "";
  superiorId: number | "";
  esSuperadmin: boolean;
  isActive: boolean;
  /** Códigos de sus programas de Ucheck. */
  programasUcheck: string[];
}

// Usuario de la sesión, tal como lo devuelve la API (/auth/me, /auth/login)
export interface UsuarioSesion {
  id: number;
  nombre: string;
  apellido: string;
  correo: string;
  nombreLogin: string;
  ruc: string | null;
  celular: string;
  legajo: string | null;
  /** Cambia con cada foto nueva; null si no tiene foto de perfil. */
  fotoPerfilVersion: string | null;
  esSuperadmin: boolean;
  puedeAdministrarUsuarios: boolean;
  esAdminTi: boolean;
  /** Superadmin y roles administrativos; los de campo solo ven "Mis datos". */
  puedeEditarPerfil?: boolean;
  empresa: { id: number; nombre: string };
  rol: {
    id: number;
    descripcion: string;
    equipoCampo: EquipoCampo | null;
    /** Jefatura que supervisa varios equipos (sin equipo propio). */
    gestionaEquipos?: boolean;
    /** Equipo con el que eligió trabajar la jefatura; null = todos. */
    equipoGestion?: EquipoCampo | null;
  } | null;
}

export interface UsuarioAdmin extends DatosErpUsuario {
  id: number;
  nombre: string;
  apellido: string;
  correo: string;
  nombreLogin: string;
  ruc: string | null;
  celular: string;
  legajo: string | null;
  /** Name del canal (tbl_jcanales) y de la sucursal (tbl_oclp) elegidos. */
  canalVentaNombre: string | null;
  sucursalNombre: string | null;
  /** SalesEmployeeName de tbl_oslp del Código Vendedor (ERP_CodUsuarioSap). */
  vendedorSapNombre: string | null;
  empresa: { id: number; nombre: string };
  rol: { id: number; descripcion: string } | null;
  superior: { id: number; nombre: string } | null;
  esSuperadmin: boolean;
  isActive: boolean;
  /** Copia de sus programas de Ucheck (códigos), como los confirmó Ucheck. */
  programasUcheck: string[];
  createdAt: string;
}

export interface MetaUsuarios {
  empresas: { id: number; nombre: string }[];
  esSuperadmin: boolean;
}

export interface UsuarioLocalAsignacion {
  id: number;
  localId: string;
  nombreLocal: string;
  fechaDesde: string;
  fechaHasta: string | null;
}

/** Canal de venta y sucursal de SAP del usuario, para Mis datos (solo lectura). */
export interface DatosSapPerfil {
  canalVenta: string | null;
  sucursal: string | null;
}
