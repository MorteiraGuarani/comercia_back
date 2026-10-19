import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CampoAccesoService } from './campo-acceso.service';
import { esRolLiderCampo } from './utils/equipo-campo';
import type { PrismaService } from '../prisma/prisma.service';
import type { AccesoPlataformaService } from '../plataforma/acceso-plataforma.service';
jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));
describe('Alcance de campo', () => {
  const equipoCampo = {
    id: 1,
    nombre: 'Impulsadores',
    tipo: 'IMPULSADOR',
    activo: true,
  };
  // Supervisor 20 → TeamLeader 25 → impulsador 30. El 40 es de otro líder.
  const jerarquia: Record<number, number[]> = { 20: [25], 25: [30], 50: [40] };
  function preparar() {
    const prisma = {
      usuario: {
        findFirst: jest.fn().mockResolvedValue({
          rol: { descripcion: 'Supervisor', equipoCampo },
        }),
        findUnique: jest.fn().mockResolvedValue({
          id: 20,
          empresaId: 10,
          isActive: true,
          rol: { equipoCampoId: 1 },
        }),
        findMany: jest.fn(
          ({ where }: { where: { superiorId: { in: number[] } } }) =>
            Promise.resolve(
              where.superiorId.in
                .flatMap((id) => jerarquia[id] ?? [])
                .map((id) => ({ id })),
            ),
        ),
      },
    };
    const plataforma = {
      exigirAccesoAlgunaPagina: jest
        .fn()
        .mockResolvedValue({ id: 30, equipoCampo }),
    };
    const service = new CampoAccesoService(
      prisma as unknown as PrismaService,
      plataforma as unknown as AccesoPlataformaService,
    );
    return { prisma, plataforma, service };
  }
  it('reconoce a TeamLeaders y Supervisores de cualquier equipo', () => {
    for (const rol of [
      'TeamLeader',
      'Team Leader Impulsador',
      'Supervisor',
      'Supervisor Impulsador',
      'Supervisor Repositor',
    ])
      expect(esRolLiderCampo(rol)).toBe(true);
    for (const rol of ['Repositor', 'Impulsador', 'Administrador', null])
      expect(esRolLiderCampo(rol)).toBe(false);
  });

  it('los líderes consultan el catálogo pero no lo modifican', async () => {
    const { plataforma, service } = preparar();
    const exigir = jest.fn().mockResolvedValue({
      id: 20,
      empresaId: 10,
      rolDescripcion: 'Supervisor Repositor',
      equipoCampo: { ...equipoCampo, tipo: 'REPOSITOR' },
    });
    Object.assign(plataforma, { exigirAccesoPagina: exigir });
    await expect(service.gestionar(20, 'locales')).resolves.toMatchObject({
      id: 20,
    });
    await expect(service.administrar(20, 'locales')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    exigir.mockResolvedValue({
      id: 5,
      empresaId: 10,
      rolDescripcion: 'Administrador de campo',
      equipoCampo,
    });
    await expect(service.administrar(5, 'locales')).resolves.toMatchObject({
      id: 5,
    });
  });

  it('rechaza usuarios fuera de la cadena del líder', async () => {
    const { prisma, plataforma, service } = preparar();
    await expect(service.subordinado(10, 20, 40)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.usuario.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          superiorId: { in: [20] },
          empresaId: 10,
          isActive: true,
          esSuperadmin: false,
          rol: { equipoCampoId: 1 },
        },
      }),
    );
    expect(plataforma.exigirAccesoAlgunaPagina).not.toHaveBeenCalled();
  });
  it('permite al supervisor asignar a los impulsadores de sus TeamLeaders', async () => {
    const { plataforma, service } = preparar();
    await expect(service.subordinado(10, 20, 30)).resolves.toEqual({ id: 30 });
    await expect(service.subordinado(10, 20, 25)).resolves.toEqual({ id: 25 });
    expect(plataforma.exigirAccesoAlgunaPagina).toHaveBeenCalledWith(
      30,
      'mi-jornada',
      ['locales', 'tareas'],
    );
  });
  it('usa permisos de módulos en lugar de nombres de roles', async () => {
    const plataforma = {
      exigirAccesoPagina: jest.fn().mockResolvedValue({
        id: 1,
        equipoCampo: {
          id: 1,
          nombre: 'Impulsadores',
          tipo: 'IMPULSADOR',
          activo: true,
        },
      }),
      exigirAccesoAlgunaPagina: jest.fn().mockResolvedValue({
        id: 1,
        equipoCampo: {
          id: 1,
          nombre: 'Impulsadores',
          tipo: 'IMPULSADOR',
          activo: true,
        },
      }),
    };
    const service = new CampoAccesoService(
      {} as PrismaService,
      plataforma as unknown as AccesoPlataformaService,
    );
    await service.gestionar(1, 'tareas');
    await service.ejecutar(1);
    expect(plataforma.exigirAccesoPagina).toHaveBeenCalledWith(
      1,
      'gestion-campo',
      'tareas',
    );
    expect(plataforma.exigirAccesoAlgunaPagina).toHaveBeenCalledWith(
      1,
      'mi-jornada',
      ['locales', 'tareas'],
    );
  });
});
