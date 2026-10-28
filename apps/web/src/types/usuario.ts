import type { CountryCode } from "libphonenumber-js";
import type { EquipoCampo } from "./rol";

export interface DatosErpUsuario {
  ERP_CanalVenta: string | null;
  ERP_Almacen: string | null;
  ERP_Supervisor: string | null;
  ERP_Vendedor: number | null;
  ERP_Repositor: string | null;
  ERP_Impulsador: string | null;
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
  empresa: { id: number; nombre: string };
  rol: {
    id: number;
    descripcion: string;
    equipoCampo: EquipoCampo | null;
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
  empresa: { id: number; nombre: string };
  rol: { id: number; descripcion: string } | null;
  superior: { id: number; nombre: string } | null;
  esSuperadmin: boolean;
  isActive: boolean;
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
