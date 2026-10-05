import {
  DestinatarioTareaCampo,
  Prisma,
} from '../../../generated/prisma/client';

// El local es compartido. La planificación pertenece al equipo del rol.
export function destinatarioCampo(rol?: string | null): DestinatarioTareaCampo {
  const nombre = rol?.toLowerCase().replace(/[^a-z]/g, '');
  return nombre === 'repositor' || nombre === 'supervisorrepositores'
    ? DestinatarioTareaCampo.REPOSITOR
    : DestinatarioTareaCampo.IMPULSADOR;
}

export function rolDelEquipoCampo(rol?: string | null): Prisma.RolWhereInput {
  return destinatarioCampo(rol) === DestinatarioTareaCampo.REPOSITOR
    ? { descripcion: 'REPOSITOR' }
    : { descripcion: { notIn: ['REPOSITOR', 'SUPERVISOR_REPOSITORES'] } };
}
