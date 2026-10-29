import type { EquipoCampoDto } from '../../roles/interfaces/equipo-campo.interface';
// Forma mínima del usuario que devuelve la API (/auth/me, /auth/login).
// Sin campos internos (passwordHash, etc.) — ver reglas de exposición en AGENTS.md.
export interface UsuarioSesion {
  id: number;
  nombre: string;
  apellido: string;
  correo: string;
  nombreLogin: string;
  ruc: string | null;
  celular: string;
  legajo: string | null;
  /** Cambia cuando cambia la foto (sirve para no mostrar una vieja de la caché); null sin foto. */
  fotoPerfilVersion: string | null;
  esSuperadmin: boolean;
  puedeAdministrarUsuarios: boolean;
  /** Puede cambiar sus propios datos y foto en "Mis datos". */
  puedeEditarPerfil: boolean;
  empresa: { id: number; nombre: string };
  rol: {
    id: number;
    descripcion: string;
    equipoCampo: EquipoCampoDto | null;
    /** Jefatura que supervisa varios equipos (sin equipo propio). */
    gestionaEquipos: boolean;
    /** Equipo con el que eligió trabajar la jefatura; null = todos. */
    equipoGestion: EquipoCampoDto | null;
  } | null;
}
