// Usuario de la sesión, tal como lo devuelve la API (/auth/me, /auth/login)
export interface UsuarioSesion {
  id: number;
  nombre: string;
  apellido: string;
  correo: string;
  nombreLogin: string;
  ruc: string;
  celular: string;
  esSuperadmin: boolean;
  puedeAdministrarUsuarios: boolean;
  empresa: { id: number; nombre: string };
  rol: { id: number; descripcion: string } | null;
}

export interface UsuarioAdmin {
  id: number;
  nombre: string;
  apellido: string;
  correo: string;
  nombreLogin: string;
  ruc: string;
  celular: string;
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
  localId: number;
  nombreLocal: string;
  nombreCliente: string;
  fechaDesde: string;
  fechaHasta: string | null;
}
