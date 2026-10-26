import type { EquipoCampoDto } from '../../roles/interfaces/equipo-campo.interface';

export interface GestorEquipoCampo {
  id: number;
  empresaId: number;
  equipoCampo?: EquipoCampoDto | null;
}
