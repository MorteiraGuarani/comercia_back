import type { EquipoCampoDto } from '../../roles/interfaces/equipo-campo.interface';

/** Rol de jefatura (jefe de canal, back office de canal, gerencia). */
export interface AlcanceGestor {
  /** Supervisa todos los equipos activos de la empresa. */
  todos: boolean;
  /** Equipos que supervisa cuando no son todos. */
  ids: number[];
  /** Equipo elegido para trabajar ahora; null = todos sus equipos juntos. */
  activo: EquipoCampoDto | null;
}
