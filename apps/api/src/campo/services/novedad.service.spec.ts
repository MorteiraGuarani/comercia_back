/* eslint-disable @typescript-eslint/no-unsafe-assignment -- Partial Prisma mocks are intentionally cast at the service boundary. */

import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import type { NotificacionService } from './notificacion.service';
import type { AdjuntoCampoService } from './adjunto-campo.service';

jest.mock('../../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));
jest.mock('./adjunto-campo.service', () => ({
  AdjuntoCampoService: class AdjuntoCampoService {},
}));

import { NovedadService } from './novedad.service';

const adjuntosMock = () =>
  ({
    guardarParaNovedad: jest.fn().mockResolvedValue([]),
    descartarArchivos: jest.fn(),
  }) as unknown as AdjuntoCampoService;

describe('NovedadService', () => {
  it('permite abrir todo el detalle al superior indirecto sin equipo operativo, y excluye otras cadenas', async () => {
    const personas = [
      { id: 1, empresaId: 10, superiorId: null, isActive: true },
      { id: 2, empresaId: 10, superiorId: 1, isActive: true },
      { id: 3, empresaId: 10, superiorId: 2, isActive: true },
    ];
    const prisma = {
      novedadCampo: { findUnique: jest.fn().mockResolvedValue({ id: 5, usuarioId: 3, local: { CardCode: 'L1', CardName: 'Local' }, descripcion: 'Detalle completo' }) },
      usuario: { findMany: jest.fn(({ where }: { where: { empresaId: number; id: { in: number[] } } }) => Promise.resolve(personas.filter((u) => u.empresaId === where.empresaId && where.id.in.includes(u.id)))) },
    };
    const service = new NovedadService(prisma as unknown as PrismaService, {} as NotificacionService, adjuntosMock());
    expect(await service.obtenerPorId(1, 10, 5)).toMatchObject({ descripcion: 'Detalle completo' });
    await expect(service.obtenerPorId(99, 10, 5)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.obtenerPorId(1, 20, 5)).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('lanza NotFoundException si el local no existe en la empresa', async () => {
    const prisma = {
      socioNegocio: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const notificaciones = {
      crearNotificacionNovedad: jest.fn(),
    };
    const service = new NovedadService(
      prisma as unknown as PrismaService,
      notificaciones as unknown as NotificacionService,
      adjuntosMock(),
    );

    await expect(
      service.crear(1, 10, {
        localId: 'L999',
        tipo: 'RECLAMO',
        titulo: 'Faltante de stock',
        descripcion: 'No hay cajas de molida',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('crea la novedad y notifica al líder', async () => {
    const prisma = {
      socioNegocio: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ CardCode: 'L10', CardName: 'Super 1' }),
      },
      novedadCampo: {
        create: jest.fn().mockResolvedValue({
          id: 5,
          empresaId: 10,
          usuarioId: 1,
          localId: 'L10',
          local: { CardCode: 'L10', CardName: 'Super 1' },
          tipo: 'INCIDENCIA',
          estado: 'ABIERTA',
          titulo: 'Local cerrado',
          descripcion: 'El local no abrió hoy',
        }),
      },
    };
    const notificaciones = {
      crearNotificacionNovedad: jest.fn().mockResolvedValue(undefined),
    };
    const service = new NovedadService(
      prisma as unknown as PrismaService,
      notificaciones as unknown as NotificacionService,
      adjuntosMock(),
    );

    const res = await service.crear(1, 10, {
      localId: 'L10',
      tipo: 'INCIDENCIA',
      titulo: 'Local cerrado',
      descripcion: 'El local no abrió hoy',
    });

    expect(res.id).toBe(5);
    expect(prisma.novedadCampo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          empresaId: 10,
          usuarioId: 1,
          localId: 'L10',
        }),
      }),
    );
    expect(notificaciones.crearNotificacionNovedad).toHaveBeenCalledWith(
      10,
      1,
      5,
      'Super 1',
      'INCIDENCIA',
    );
  });

  it('pagina los locales dentro del alcance del impulsador sin usar permisos de gestión', async () => {
    const prisma = {
      socioNegocio: {
        count: jest.fn().mockResolvedValue(8),
        findMany: jest
          .fn()
          .mockResolvedValue([{ CardCode: 'L12', CardName: 'Local asignado' }]),
      },
    };
    const service = new NovedadService(
      prisma as unknown as PrismaService,
      {} as NotificacionService,
      adjuntosMock(),
    );
    const respuesta = await service.locales(1, 10, {
      page: 2,
      limit: 7,
      buscar: 'Local',
    });
    expect(respuesta.items).toEqual([{ id: 'L12', nombre: 'Local asignado' }]);
    expect(prisma.socioNegocio.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 7,
        take: 7,
        select: { CardCode: true, CardName: true },
        where: expect.objectContaining({
          empresaId: 10,
          OR: expect.arrayContaining([{ visitas: { some: { usuarioId: 1 } } }]),
        }),
      }),
    );
  });

  it('impide a un líder filtrar novedades de usuarios ajenos a su equipo', async () => {
    const prisma = {
      usuario: {
        findUnique: jest
          .fn()
          .mockImplementation(({ where }: { where: { id: number } }) =>
            Promise.resolve(
              where.id === 1
                ? { id: 1, rol: { hijos: [{ usuarios: [{ id: 2 }] }] } }
                : { id: 2, rol: null },
            ),
          ),
      },
    };
    const service = new NovedadService(
      prisma as unknown as PrismaService,
      {} as NotificacionService,
      adjuntosMock(),
    );
    await expect(
      service.listar(1, 10, { usuarioId: 999 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('guarda una respuesta y notifica sin cerrar la novedad', async () => {
    const prisma = {
      novedadCampo: { update: jest.fn() },
      respuestaNovedadCampo: {
        create: jest
          .fn()
          .mockResolvedValue({ id: 9, mensaje: 'Seguimos revisando' }),
      },
    };
    const notificaciones = {
      crearNotificacionRespuestaNovedad: jest.fn().mockResolvedValue(undefined),
    };
    const service = new NovedadService(
      prisma as unknown as PrismaService,
      notificaciones as unknown as NotificacionService,
      adjuntosMock(),
    );
    jest.spyOn(service, 'obtenerPorId').mockResolvedValue({
      id: 5,
      estado: 'ABIERTA',
      titulo: 'Faltante',
      usuarioId: 2,
    } as never);

    await expect(
      service.responder(1, 10, 5, { mensaje: ' Seguimos revisando ' }),
    ).resolves.toMatchObject({ id: 9, mensaje: 'Seguimos revisando' });
    expect(prisma.novedadCampo.update).not.toHaveBeenCalled();
    expect(prisma.respuestaNovedadCampo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { novedadId: 5, usuarioId: 1, mensaje: 'Seguimos revisando' },
      }),
    );
    expect(
      notificaciones.crearNotificacionRespuestaNovedad,
    ).toHaveBeenCalledWith(10, 1, 2, 5, 'Faltante');
  });

  it('rechaza respuestas en una novedad ya cerrada', async () => {
    const prisma = { respuestaNovedadCampo: { create: jest.fn() } };
    const service = new NovedadService(
      prisma as unknown as PrismaService,
      {} as NotificacionService,
      adjuntosMock(),
    );
    jest
      .spyOn(service, 'obtenerPorId')
      .mockResolvedValue({ estado: 'CERRADA' } as never);
    await expect(
      service.responder(1, 10, 5, { mensaje: 'Otra respuesta' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.respuestaNovedadCampo.create).not.toHaveBeenCalled();
  });
});
