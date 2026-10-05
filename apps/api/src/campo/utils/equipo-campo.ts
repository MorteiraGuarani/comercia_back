import { ForbiddenException } from '@nestjs/common';
import {
  DestinatarioTareaCampo,
  Prisma,
} from '../../../generated/prisma/client';
import type { EquipoCampoDto } from '../../roles/interfaces/equipo-campo.interface';

export function exigirEquipoCampo(
  equipo?: EquipoCampoDto | null,
): EquipoCampoDto {
  if (!equipo?.activo || equipo.tipo === DestinatarioTareaCampo.AMBOS)
    throw new ForbiddenException(
      'Tu rol no tiene un equipo operativo activo. Pedí a un administrador que lo configure en Roles.',
    );
  return equipo;
}

export function destinatarioCampo(
  equipo?: EquipoCampoDto | null,
): DestinatarioTareaCampo {
  return exigirEquipoCampo(equipo).tipo;
}

export function rolDelEquipoCampo(
  equipo?: EquipoCampoDto | null,
): Prisma.RolWhereInput {
  return { equipoCampoId: exigirEquipoCampo(equipo).id };
}

export const EQUIPO_CAMPO_SELECT = {
  id: true,
  nombre: true,
  tipo: true,
  activo: true,
} as const;
