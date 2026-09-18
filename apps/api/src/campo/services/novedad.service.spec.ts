/* eslint-disable @typescript-eslint/no-unsafe-assignment -- Partial Prisma mocks are intentionally cast at the service boundary. */

import { NotFoundException, ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import type { NotificacionService } from './notificacion.service';

jest.mock('../../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

import { NovedadService } from './novedad.service';

describe('NovedadService', () => {
  it('lanza NotFoundException si el local no existe en la empresa', async () => {
    const prisma = {
      localCampo: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const notificaciones = {
      crearNotificacionNovedad: jest.fn(),
    };
    const service = new NovedadService(
      prisma as unknown as PrismaService,
      notificaciones as unknown as NotificacionService,
    );

    await expect(
      service.crear(1, 10, {
        localId: 999,
        tipo: 'RECLAMO',
        titulo: 'Faltante de stock',
        descripcion: 'No hay cajas de molida',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('crea la novedad y notifica al líder', async () => {
    const prisma = {
      localCampo: { findFirst: jest.fn().mockResolvedValue({ id: 10, nombre: 'Super 1' }) },
      novedadCampo: {
        create: jest.fn().mockResolvedValue({
          id: 5,
          empresaId: 10,
          usuarioId: 1,
          localId: 10,
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
    );

    const res = await service.crear(1, 10, {
      localId: 10,
      tipo: 'INCIDENCIA',
      titulo: 'Local cerrado',
      descripcion: 'El local no abrió hoy',
    });

    expect(res.id).toBe(5);
    expect(prisma.novedadCampo.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ empresaId: 10, usuarioId: 1, localId: 10 }),
    }));
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
      localCampo: {
        count: jest.fn().mockResolvedValue(8),
        findMany: jest.fn().mockResolvedValue([{ id: 12, nombre: 'Local asignado' }]),
      },
    };
    const service = new NovedadService(prisma as unknown as PrismaService, {} as NotificacionService);
    const respuesta = await service.locales(1, 10, { page: 2, limit: 7, buscar: 'Local' });
    expect(respuesta.items).toEqual([{ id: 12, nombre: 'Local asignado' }]);
    expect(prisma.localCampo.findMany).toHaveBeenCalledWith(expect.objectContaining({
      skip: 7, take: 7, select: { id: true, nombre: true },
      where: expect.objectContaining({
        cliente: { empresaId: 10, activo: true },
        OR: expect.arrayContaining([{ visitas: { some: { usuarioId: 1 } } }]),
      }),
    }));
  });

  it('impide a un líder filtrar novedades de usuarios ajenos a su equipo', async () => {
    const prisma = {
      usuario: { findUnique: jest.fn().mockImplementation(({ where }: { where: { id: number } }) => Promise.resolve(
        where.id === 1 ? { id: 1, rol: { hijos: [{ usuarios: [{ id: 2 }] }] } } : { id: 2, rol: null },
      )) },
    };
    const service = new NovedadService(prisma as unknown as PrismaService, {} as NotificacionService);
    await expect(service.listar(1, 10, { usuarioId: 999 })).rejects.toBeInstanceOf(ForbiddenException);
  });
});
