import type { Prisma } from '../../../generated/prisma/client';
import { fechaCampo, relojCampo } from './calendario';
import { localesOperativos } from './locales-operativos';

export function localesParaNovedad(
  usuarioId: number,
  empresaId: number,
): Prisma.LocalCampoWhereInput {
  const fecha = fechaCampo(relojCampo().fecha);
  return {
    ...localesOperativos(empresaId),
    OR: [
      { visitas: { some: { usuarioId } } },
      {
        asignaciones: {
          some: {
            activo: true,
            fechaDesde: { lte: fecha },
            AND: [
              { OR: [{ fechaHasta: null }, { fechaHasta: { gte: fecha } }] },
              {
                OR: [
                  { usuarioId },
                  {
                    backups: {
                      some: {
                        usuarioId,
                        activo: true,
                        fechaDesde: { lte: fecha },
                        fechaHasta: { gte: fecha },
                      },
                    },
                  },
                ],
              },
            ],
          },
        },
      },
    ],
  };
}
