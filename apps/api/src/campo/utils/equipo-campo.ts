import { ForbiddenException } from '@nestjs/common';
import {
  DestinatarioTareaCampo,
  Prisma,
} from '../../../generated/prisma/client';
import type { EquipoCampoDto } from '../../roles/interfaces/equipo-campo.interface';

export const SIN_EQUIPO_OPERATIVO =
  'Tu rol no tiene un equipo operativo activo. Pedí a un administrador que lo configure en Roles.';

export function exigirEquipoCampo(
  equipo?: EquipoCampoDto | null,
): EquipoCampoDto {
  if (!equipo?.activo || equipo.tipo === DestinatarioTareaCampo.AMBOS)
    throw new ForbiddenException(SIN_EQUIPO_OPERATIVO);
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

/** Rol con un equipo operativo activo (titular de una asignación operable). */
export const ROL_OPERATIVO: Prisma.RolWhereInput = {
  equipoCampo: {
    activo: true,
    tipo: { not: DestinatarioTareaCampo.AMBOS },
  },
};

/**
 * Una asignación se opera con el equipo de su titular: un líder que visita un
 * local heredado de otro equipo ve sus horarios y hace sus tareas.
 */
export const EQUIPO_TITULAR_SELECT = {
  usuario: {
    select: {
      rol: { select: { equipoCampo: { select: EQUIPO_CAMPO_SELECT } } },
    },
  },
} as const;
