import type { DestinatarioTareaCampo } from '../../../generated/prisma/client';

export interface EquipoCampoDto {
  id: number;
  nombre: string;
  tipo: DestinatarioTareaCampo;
  activo: boolean;
}
