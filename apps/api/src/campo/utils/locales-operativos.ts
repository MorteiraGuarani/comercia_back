import type { Prisma } from '../../../generated/prisma/client';

/** Un local conservado sin cliente sigue siendo operativo en su empresa. */
export function localesOperativos(
  empresaId: number,
): Prisma.LocalCampoWhereInput {
  return {
    empresaId,
    eliminadoEn: null,
    activo: true,
    AND: [
      {
        OR: [
          { clienteId: null },
          { cliente: { activo: true, eliminadoEn: null } },
        ],
      },
    ],
  };
}
