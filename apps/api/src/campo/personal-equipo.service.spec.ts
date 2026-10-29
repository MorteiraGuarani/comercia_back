import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import type { AccesoPlataformaService } from '../plataforma/acceso-plataforma.service';
import { AsignacionCampoDto } from './dto/campo.dto';
import { filtroPersonalEquipoOperativo } from './utils/personal-equipo';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));
import { CampoAccesoService } from './campo-acceso.service';
import { PlanificacionCampoService } from './planificacion-campo.service';
import { CatalogoCampoService } from './catalogo-campo.service';

function preparar(tipo: 'REPOSITOR' | 'IMPULSADOR' = 'REPOSITOR') {
  const equipo = { id: 4, nombre: 'Equipo propio', tipo, activo: true };
  const gestor = { id: 11, empresaId: 10, equipoCampo: equipo };
  const prisma = {
    usuario: {
      findFirst: jest
        .fn()
        .mockResolvedValueOnce({ rol: { equipoCampo: equipo } })
        .mockResolvedValue({ id: 22 }),
    },
    socioNegocio: {
      findFirst: jest.fn().mockResolvedValue({ CardCode: 'C1' }),
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
    },
    asignacionCampo: {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({ id: 9 }),
    },
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation((fn: (tx: typeof prisma) => unknown) =>
    fn(prisma),
  );
  const plataforma = {
    exigirAccesoPagina: jest.fn().mockResolvedValue(gestor),
    exigirAccesoAlgunaPagina: jest
      .fn()
      .mockResolvedValue({ ...gestor, id: 22 }),
  };
  const acceso = new CampoAccesoService(
    prisma as unknown as PrismaService,
    plataforma as unknown as AccesoPlataformaService,
  );
  return {
    gestor,
    prisma,
    plataforma,
    acceso,
    plan: new PlanificacionCampoService(
      prisma as unknown as PrismaService,
      acceso,
    ),
    catalogo: new CatalogoCampoService(
      prisma as unknown as PrismaService,
      acceso,
    ),
  };
}

describe('Personal de los ABM por equipo operativo', () => {
  it.each(['REPOSITOR', 'IMPULSADOR'] as const)(
    'asigna personal de %s aunque no haya una relación de superior',
    async (tipo) => {
      const { plan, prisma, plataforma } = preparar(tipo);
      await plan.asignar(
        11,
        'C1',
        Object.assign(new AsignacionCampoDto(), {
          usuarioId: 22,
          fechaDesde: '2026-10-26',
        }),
      );
      expect(prisma.usuario.findFirst).toHaveBeenLastCalledWith({
        where: {
          AND: [
            {
              empresaId: 10,
              id: { not: 11 },
              isActive: true,
              esSuperadmin: false,
              rol: { equipoCampoId: 4 },
            },
            { id: 22 },
          ],
        },
        select: { id: true },
      });
      expect(plataforma.exigirAccesoAlgunaPagina).toHaveBeenCalledWith(
        22,
        'mi-jornada',
        ['locales', 'tareas'],
      );
      expect(prisma.asignacionCampo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            empresaId: 10,
            localId: 'C1',
            usuarioId: 22,
          }) as unknown,
        }),
      );
    },
  );

  it('rechaza un usuario que no pertenece al alcance sin crear asignación', async () => {
    const { plan, prisma, plataforma } = preparar();
    prisma.usuario.findFirst.mockReset().mockResolvedValueOnce(null);
    await expect(
      plan.asignar(
        11,
        'C1',
        Object.assign(new AsignacionCampoDto(), {
          usuarioId: 99,
          fechaDesde: '2026-10-26',
        }),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.asignacionCampo.create).not.toHaveBeenCalled();
    expect(plataforma.exigirAccesoAlgunaPagina).not.toHaveBeenCalled();
  });

  it('sigue exigiendo acceso al ABM aunque el rol pertenezca al equipo', async () => {
    const { plan, prisma, plataforma } = preparar();
    plataforma.exigirAccesoPagina.mockRejectedValue(new ForbiddenException());
    await expect(plan.equipo(11, { page: 1, limit: 7 })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.usuario.findFirst).not.toHaveBeenCalled();
  });

  it('no permite asignar a alguien sin permiso para ejecutar su jornada', async () => {
    const { plan, prisma, plataforma } = preparar();
    plataforma.exigirAccesoAlgunaPagina.mockRejectedValue(
      new ForbiddenException(),
    );
    await expect(
      plan.asignar(
        11,
        'C1',
        Object.assign(new AsignacionCampoDto(), {
          usuarioId: 22,
          fechaDesde: '2026-10-26',
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.asignacionCampo.create).not.toHaveBeenCalled();
  });

  it.each(['locales', 'localesMapa'] as const)(
    '%s muestra las asignaciones con el mismo alcance del selector de personal',
    async (metodo) => {
      const { catalogo, prisma, gestor } = preparar();
      await catalogo[metodo](11, { page: 1, limit: 7 });
      expect(prisma.socioNegocio.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            asignaciones: expect.objectContaining({
              where: expect.objectContaining({
                usuario: filtroPersonalEquipoOperativo(gestor),
              }) as unknown,
            }) as unknown,
          }) as unknown,
        }),
      );
      expect(prisma.usuario.findFirst).not.toHaveBeenCalled();
    },
  );
});
