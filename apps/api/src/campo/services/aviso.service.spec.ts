import { BadRequestException, ForbiddenException } from '@nestjs/common';
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
      usuario: { findMany: jest.fn().mockResolvedValue([{ id: 2 }, { id: 3 }]) },
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
    expect(notificaciones.crearNotificacionAviso).toHaveBeenCalledTimes(2);
  });

  it('impide enviar avisos individuales fuera del equipo asignado', async () => {
    const prisma = {
      usuario: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new AvisoService(
      prisma as unknown as PrismaService,
      { crearNotificacionAviso: jest.fn() } as unknown as NotificacionService,
    );

    await expect(
      service.crear(1, 10, {
        tipo: 'INDIVIDUAL',
        destinatarioId: 2,
        mensaje: 'Hola',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('no incluye comunicados de equipo en la bandeja de quien no tiene superior', async () => {
    const prisma = {
      usuario: { findUnique: jest.fn().mockResolvedValue({ superiorId: null }) },
      avisoCampo: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    const service = new AvisoService(
      prisma as unknown as PrismaService,
      {} as NotificacionService,
    );

    await service.listarRecibidos(1, 10, { page: 1, limit: 7 });

    expect(prisma.avisoCampo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          empresaId: 10,
          OR: [{ destinatarioId: 1, emisorId: { not: 1 } }],
        },
      }),
    );
  });

  it('cuenta solo las lecturas de los colaboradores actuales', async () => {
    const prisma = {
      usuario: { findMany: jest.fn().mockResolvedValue([{ id: 2 }]) },
      avisoCampo: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 7,
            tipo: 'EQUIPO',
            mensaje: 'Reunion',
            creadoAt: new Date('2026-09-21T12:00:00.000Z'),
            lecturas: [
              { usuarioId: 1, leidoAt: new Date('2026-09-21T12:01:00.000Z') },
              { usuarioId: 2, leidoAt: new Date('2026-09-21T12:02:00.000Z') },
            ],
          },
        ]),
        count: jest.fn().mockResolvedValue(1),
      },
    };
    const service = new AvisoService(
      prisma as unknown as PrismaService,
      {} as NotificacionService,
    );

    const resultado = await service.listarEnviados(1, 10, { page: 1, limit: 7 });

    expect(resultado.items[0]).toMatchObject({ leidoPor: 1, total: 1 });
  });

  it('no permite confirmar un aviso que no pertenece al usuario', async () => {
    const prisma = {
      usuario: { findUnique: jest.fn().mockResolvedValue({ superiorId: null }) },
      avisoCampo: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = new AvisoService(
      prisma as unknown as PrismaService,
      {} as NotificacionService,
    );

    await expect(service.marcarLeido(1, 10, 99)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.avisoCampo.findFirst).toHaveBeenCalledWith({
      where: {
        id: 99,
        empresaId: 10,
        OR: [{ destinatarioId: 1, emisorId: { not: 1 } }],
      },
      select: { id: true },
    });
  });
});
