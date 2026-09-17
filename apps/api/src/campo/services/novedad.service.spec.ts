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
    expect(notificaciones.crearNotificacionNovedad).toHaveBeenCalledWith(
      10,
      1,
      5,
      'Super 1',
      'INCIDENCIA',
    );
  });
});
