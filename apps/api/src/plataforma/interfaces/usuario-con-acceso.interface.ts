import type { EquipoCampoDto } from '../../roles/interfaces/equipo-campo.interface';

export interface UsuarioConAcceso {
  id: number;
  empresaId: number;
  rolId: number | null;
  rolDescripcion: string | null;
  equipoCampo: EquipoCampoDto | null;
}
