import type { EquipoCampoDto } from './equipo-campo.interface';

export interface RolAdminFila {
  empresa: { id: number; nombre: string };
  id: number;
  descripcion: string;
  padre: { id: number; descripcion: string } | null;
  _count: { usuarios: number; hijos: number };
  equipoCampo?: EquipoCampoDto | null;
}

export interface RolAdminDto {
  empresa: { id: number; nombre: string };
  id: number;
  descripcion: string;
  padre: { id: number; descripcion: string } | null;
  usuariosCount: number;
  hijosCount: number;
  equipoCampo: EquipoCampoDto | null;
}
