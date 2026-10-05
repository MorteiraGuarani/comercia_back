/* eslint-disable @typescript-eslint/no-unsafe-assignment -- Jest objectContaining returns any. */
import type { PrismaService } from '../prisma/prisma.service';
import type { CampoAccesoService } from './campo-acceso.service';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

import { PlanificacionCampoService } from './planificacion-campo.service';

describe('PlanificacionCampoService', () => {
  it('muestra solo repositores directos al supervisor nuevo', async () => {
    const prisma = {
      usuario: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const acceso = {
      gestionar: jest.fn().mockResolvedValue({
        id: 3,
        empresaId: 10,
        rolDescripcion: 'SUPERVISOR_REPOSITORES',
        equipoCampo: {
          id: 2,
          nombre: 'Repositores',
          tipo: 'REPOSITOR',
          activo: true,
        },
      }),
    };
    const service = new PlanificacionCampoService(
      prisma as unknown as PrismaService,
      acceso as unknown as CampoAccesoService,
    );
    await service.equipo(3, { page: 1, limit: 7 });
    expect(prisma.usuario.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          empresaId: 10,
          superiorId: 3,
          rol: { equipoCampoId: 2 },
        }),
      }),
    );
  });

  it('busca solo dentro de los colaboradores activos asignados al lider', async () => {
    const prisma = {
      usuario: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 8,
            nombre: 'Maria',
            apellido: 'Lopez',
            rol: { descripcion: 'REPOSITOR' },
          },
        ]),
      },
    };
    const acceso = {
      gestionar: jest.fn().mockResolvedValue({
        id: 3,
        empresaId: 10,
        equipoCampo: {
          id: 1,
          nombre: 'Impulsadores',
          tipo: 'IMPULSADOR',
          activo: true,
        },
      }),
    };
    const service = new PlanificacionCampoService(
      prisma as unknown as PrismaService,
      acceso as unknown as CampoAccesoService,
    );

    const respuesta = await service.equipo(3, {
      page: 1,
      limit: 7,
      buscar: 'mari',
    });

    const where = {
      rol: { equipoCampoId: 1 },
      empresaId: 10,
      superiorId: 3,
      isActive: true,
      esSuperadmin: false,
      OR: [
        { nombre: { contains: 'mari', mode: 'insensitive' } },
        { apellido: { contains: 'mari', mode: 'insensitive' } },
        { nombreLogin: { contains: 'mari', mode: 'insensitive' } },
      ],
    };
    expect(prisma.usuario.count).toHaveBeenCalledWith({ where });
    expect(prisma.usuario.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where, skip: 0, take: 7 }),
    );
    expect(respuesta.items).toMatchObject([{ id: 8 }]);
  });
});
