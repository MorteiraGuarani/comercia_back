import type { EquipoCampoDto } from '../../roles/interfaces/equipo-campo.interface';
// Forma mínima del usuario que devuelve la API (/auth/me, /auth/login).
// Sin campos internos (passwordHash, etc.) — ver reglas de exposición en AGENTS.md.
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
  rol: {
    id: number;
    descripcion: string;
    equipoCampo: EquipoCampoDto | null;
  } | null;
}
