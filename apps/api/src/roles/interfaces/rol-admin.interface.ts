import type { EquipoCampoDto } from './equipo-campo.interface';
import type { AccionTareaCampo } from '../../../generated/prisma/client';

export interface RolAdminFila {
  empresa: { id: number; nombre: string };
  id: number;
  descripcion: string;
  padre: { id: number; descripcion: string } | null;
  _count: { usuarios: number; hijos: number };
  equipoCampo?: EquipoCampoDto | null;
  permisosTareas?: AccionTareaCampo[];
  puedeVerSeguimiento?: boolean;
  gestionaTodosEquipos?: boolean;
  equiposGestion?: { equipoCampo: EquipoCampoDto }[];
}

export interface RolAdminDto {
  empresa: { id: number; nombre: string };
  id: number;
  descripcion: string;
  padre: { id: number; descripcion: string } | null;
  usuariosCount: number;
  hijosCount: number;
  equipoCampo: EquipoCampoDto | null;
  permisosTareas: AccionTareaCampo[];
  puedeVerSeguimiento: boolean;
  /** Jefaturas: supervisa todos los equipos de la empresa. */
  gestionaTodosEquipos: boolean;
  /** Jefaturas: equipos que supervisa (vacío si es de un equipo). */
  equiposGestion: EquipoCampoDto[];
}
