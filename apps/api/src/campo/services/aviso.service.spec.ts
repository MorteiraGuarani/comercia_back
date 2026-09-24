import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AdjuntoCampoService } from './adjunto-campo.service';

jest.mock('../utils/multer-config', () => ({
  validarArchivoImagen: jest.fn(),
}));

import { AvisoService } from './aviso.service';

const adjuntos = {
  descartarArchivos: jest.fn(),
} as unknown as AdjuntoCampoService;

describe('AvisoService', () => {
  it('rechaza un aviso individual sin destinatario', async () => {
    const prisma = {
      usuario: { findMany: jest.fn().mockResolvedValue([{ id: 2 }]) },
    };
    const service = new AvisoService(
      prisma as unknown as PrismaService,
      adjuntos,
    );
    await expect(
      service.crear(1, 10, { tipo: 'INDIVIDUAL', mensaje: 'Hola' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('publica el aviso y sus notificaciones en una transacción', async () => {
    const tx = {
      usuario: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ nombre: 'Ana', apellido: 'López' }),
      },
      avisoCampo: {
        create: jest.fn().mockResolvedValue({
          id: 7,
          tipo: 'EQUIPO',
          mensaje: 'Reunión a las 18:00',
        }),
      },
      notificacionCampo: {
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      adjuntoCampo: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const prisma = {
      usuario: {
        findMany: jest.fn().mockResolvedValue([{ id: 2 }, { id: 3 }]),
      },
      $transaction: jest.fn((fn: (client: typeof tx) => Promise<unknown>) =>
        fn(tx),
      ),
    };
    const service = new AvisoService(
      prisma as unknown as PrismaService,
      adjuntos,
    );
    const res = await service.crear(1, 10, {
      tipo: 'EQUIPO',
      mensaje: 'Reunión a las 18:00',
    });
    expect(res).toMatchObject({ id: 7, adjuntos: [] });
    const creacion = (
      tx.avisoCampo.create.mock.calls as unknown as Array<
        [
          {
            data: { destinatarios: { create: { usuarioId: number }[] } };
          },
        ]
      >
    )[0][0];
    expect(creacion.data.destinatarios.create).toEqual([
      { usuarioId: 2 },
      { usuarioId: 3 },
    ]);
    const notificaciones = (
      tx.notificacionCampo.createMany.mock.calls as unknown as Array<
        [
          {
            data: { usuarioDestinatarioId: number; referenciaId: number }[];
          },
        ]
      >
    )[0][0];
    expect(
      notificaciones.data.map((item) => [
        item.usuarioDestinatarioId,
        item.referenciaId,
      ]),
    ).toEqual([
      [2, 7],
      [3, 7],
    ]);
  });

  it('impide enviar a alguien fuera del equipo', async () => {
    const prisma = { usuario: { findMany: jest.fn().mockResolvedValue([]) } };
    const service = new AvisoService(
      prisma as unknown as PrismaService,
      adjuntos,
    );
    await expect(
      service.crear(1, 10, {
        tipo: 'INDIVIDUAL',
        destinatarioId: 2,
        mensaje: 'Hola',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('limita los avisos recibidos al destinatario confirmado o al alcance antiguo', async () => {
    const prisma = {
      usuario: {
        findUnique: jest.fn().mockResolvedValue({ superiorId: null }),
      },
      avisoCampo: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    const service = new AvisoService(
      prisma as unknown as PrismaService,
      adjuntos,
    );
    await service.listarRecibidos(1, 10, { page: 1, limit: 7 });
    expect(prisma.avisoCampo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          empresaId: 10,
          emisorId: { not: 1 },
          OR: [
            { destinatarios: { some: { usuarioId: 1 } } },
            { destinatarios: { none: {} }, OR: [{ destinatarioId: 1 }] },
          ],
        },
      }),
    );
  });

  it('cuenta las lecturas usando destinatarios fijados al enviar', async () => {
    const prisma = {
      usuario: { findMany: jest.fn().mockResolvedValue([{ id: 4 }]) },
      avisoCampo: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 7,
            tipo: 'EQUIPO',
            mensaje: 'Reunión',
            destinatarioId: null,
            creadoAt: new Date(),
            destinatario: null,
            adjuntos: [],
            destinatarios: [
              { usuarioId: 2, usuario: { id: 2, nombre: 'A', apellido: 'B' } },
            ],
            lecturas: [
              { usuarioId: 2, leidoAt: new Date() },
              { usuarioId: 4, leidoAt: new Date() },
            ],
          },
        ]),
        count: jest.fn().mockResolvedValue(1),
      },
    };
    const service = new AvisoService(
      prisma as unknown as PrismaService,
      adjuntos,
    );
    const resultado = await service.listarEnviados(1, 10, {
      page: 1,
      limit: 7,
    });
    expect(resultado.items[0]).toMatchObject({ leidoPor: 1, total: 1 });
  });

  it('no permite confirmar un aviso ajeno', async () => {
    const prisma = {
      usuario: {
        findUnique: jest.fn().mockResolvedValue({ superiorId: null }),
      },
      avisoCampo: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = new AvisoService(
      prisma as unknown as PrismaService,
      adjuntos,
    );
    await expect(service.marcarLeido(1, 10, 99)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    const consulta = (
      prisma.avisoCampo.findFirst.mock.calls as unknown as Array<
        [
          {
            where: { id: number; empresaId: number };
          },
        ]
      >
    )[0][0];
    expect(consulta.where).toMatchObject({ id: 99, empresaId: 10 });
  });

  it('limita el detalle del aviso a la empresa y a sus participantes', async () => {
    const prisma = {
      usuario: { findUnique: jest.fn().mockResolvedValue({ superiorId: 9 }) },
      avisoCampo: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = new AvisoService(
      prisma as unknown as PrismaService,
      adjuntos,
    );
    await expect(service.obtenerPorId(2, 10, 99)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    const consulta = (
      prisma.avisoCampo.findFirst.mock.calls as unknown as Array<
        [
          {
            where: { id: number; empresaId: number };
          },
        ]
      >
    )[0][0];
    expect(consulta.where).toMatchObject({ id: 99, empresaId: 10 });
  });
});
