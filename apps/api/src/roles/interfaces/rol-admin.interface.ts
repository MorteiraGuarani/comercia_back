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
}
