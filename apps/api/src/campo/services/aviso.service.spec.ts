import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import type { NotificacionService } from './notificacion.service';

jest.mock('../../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

import { AvisoService } from './aviso.service';

describe('AvisoService', () => {
  it('exige destinatarioId si el aviso es INDIVIDUAL', async () => {
    const prisma = {
      usuario: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const notificaciones = {
      crearNotificacionAviso: jest.fn(),
    };
    const service = new AvisoService(
      prisma as unknown as PrismaService,
      notificaciones as unknown as NotificacionService,
    );

    await expect(
      service.crear(1, 10, {
        tipo: 'INDIVIDUAL',
        mensaje: 'Hola',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('crea aviso de equipo y notifica a los miembros', async () => {
    const prisma = {
      usuario: {
        findUnique: jest
          .fn()
          .mockImplementation(({ where }: { where: { id: number } }) => {
          if (where.id === 1) {
            return Promise.resolve({
              id: 1,
              rol: {
                hijos: [{ usuarios: [{ id: 2 }, { id: 3 }] }],
              },
            });
          }
          return Promise.resolve({ id: where.id, rol: null });
          }),
      },
      avisoCampo: {
        create: jest.fn().mockResolvedValue({
          id: 7,
          tipo: 'EQUIPO',
          mensaje: 'Reunión a las 18:00',
        }),
      },
    };
    const notificaciones = {
      crearNotificacionAviso: jest.fn().mockResolvedValue(undefined),
    };
    const service = new AvisoService(
      prisma as unknown as PrismaService,
      notificaciones as unknown as NotificacionService,
    );

    const res = await service.crear(1, 10, {
      tipo: 'EQUIPO',
      mensaje: 'Reunión a las 18:00',
    });

    expect(res.id).toBe(7);
  });
});
