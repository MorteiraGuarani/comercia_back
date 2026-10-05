import type { EquipoCampoDto } from '../../roles/interfaces/equipo-campo.interface';
import type { AccionTareaCampo } from '../../../generated/prisma/client';

export interface UsuarioConAcceso {
  id: number;
  empresaId: number;
  rolId: number | null;
  rolDescripcion: string | null;
  equipoCampo: EquipoCampoDto | null;
  permisosTareas?: AccionTareaCampo[];
  puedeVerSeguimiento?: boolean;
}
