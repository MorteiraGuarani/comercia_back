import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CampoAccesoService } from './campo-acceso.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { AccesoPlataformaService } from '../plataforma/acceso-plataforma.service';
jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));
describe('Alcance de campo', () => {
  const equipoCampo = {
    id: 1,
    nombre: 'Impulsadores',
    tipo: 'IMPULSADOR' as const,
    activo: true,
  };
  const usuariosDelEquipo = new Set([25, 30]);
  const lider = { id: 20, empresaId: 10, equipoCampo };
  function preparar() {
    const prisma = {
      usuario: {
        findFirst: jest.fn(
          ({
            where,
          }: {
            where: {
              id?: number;
              AND?: [{ id: { not: number } }, { id: number }];
            };
          }) =>
            Promise.resolve(
              where.id === 20
                ? { rol: { descripcion: 'Supervisor', equipoCampo } }
                : usuariosDelEquipo.has(where.AND?.[1].id ?? -1)
                  ? { id: where.AND?.[1].id }
                  : null,
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
  it('rechaza usuarios fuera del equipo operativo del líder', async () => {
    const { prisma, plataforma, service } = preparar();
    await expect(service.subordinado(lider, 40)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.usuario.findFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            {
              empresaId: 10,
              id: { not: 20 },
              isActive: true,
              esSuperadmin: false,
              rol: { equipoCampoId: 1 },
            },
            { id: 40 },
          ],
        },
      }),
    );
    expect(plataforma.exigirAccesoAlgunaPagina).not.toHaveBeenCalled();
  });
  it('permite al supervisor asignar a los impulsadores de sus TeamLeaders', async () => {
    const { plataforma, service } = preparar();
    await expect(service.subordinado(lider, 30)).resolves.toEqual({ id: 30 });
    await expect(service.subordinado(lider, 25)).resolves.toEqual({ id: 25 });
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

  describe('jornada propia', () => {
    function conPlataforma(itinerario: unknown) {
      const plataforma = {
        exigirAccesoAlgunaPagina: jest
          .fn()
          .mockRejectedValue(new ForbiddenException()),
        exigirAccesoPagina: jest.fn(
          (_id: number, modulo: string, pagina: string) =>
            modulo === 'gestion-campo' && pagina === 'itinerario' && itinerario
              ? Promise.resolve(itinerario)
              : Promise.reject(new ForbiddenException()),
        ),
      };
      const prisma = {
        usuario: { findFirst: jest.fn().mockResolvedValue(null) },
      };
      return new CampoAccesoService(
        prisma as unknown as PrismaService,
        plataforma as unknown as AccesoPlataformaService,
      );
    }

    it('el supervisor con Itinerario recorre su ruta desde Gestión de campo', async () => {
      await expect(
        conPlataforma({ ...lider, rolDescripcion: 'Supervisor' }).ejecutar(20),
      ).resolves.toMatchObject({ id: 20, equipoCampo });
    });

    it('sin Itinerario ni Mi jornada no tiene jornada propia', async () => {
      await expect(conPlataforma(null).ejecutar(20)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await expect(
        conPlataforma({ ...lider, equipoCampo: null }).ejecutar(20),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('jefaturas que supervisan varios equipos', () => {
    const repositores = { ...equipoCampo, id: 2, tipo: 'REPOSITOR' };
    function conJefe(fila: unknown) {
      const plataforma = {
        exigirAccesoPagina: jest
          .fn()
          .mockResolvedValue({ id: 7, empresaId: 10, equipoCampo: null }),
      };
      const prisma = {
        usuario: { findFirst: jest.fn().mockResolvedValue(fila) },
      };
      return new CampoAccesoService(
        prisma as unknown as PrismaService,
        plataforma as unknown as AccesoPlataformaService,
      );
    }
    const jefe = (equipoGestion: unknown, ids = [1, 2], todos = false) => ({
      equipoGestion,
      rol: {
        equipoCampoId: null,
        gestionaTodosEquipos: todos,
        equiposGestion: ids.map((equipoCampoId) => ({ equipoCampoId })),
      },
    });

    it('consulta todos sus equipos juntos sin elegir uno', async () => {
      await expect(
        conJefe(jefe(null)).gestionar(7, 'visitas'),
      ).resolves.toMatchObject({ gestor: true, equipoCampo: null });
    });

    it('para administrar exige elegir uno de sus equipos', async () => {
      await expect(
        conJefe(jefe(null)).gestionar(7, 'tareas'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        conJefe(jefe(repositores)).gestionar(7, 'tareas'),
      ).resolves.toMatchObject({ gestor: true, equipoCampo: repositores });
    });

    it('ignora un equipo elegido que ya no supervisa', async () => {
      await expect(
        conJefe(jefe(repositores, [1])).gestionar(7, 'tareas'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        conJefe(jefe(repositores, [], true)).gestionar(7, 'tareas'),
      ).resolves.toMatchObject({ equipoCampo: repositores });
    });

    it('un rol sin equipo ni jefatura sigue sin acceso', async () => {
      await expect(
        conJefe(jefe(null, [])).gestionar(7, 'visitas'),
      ).rejects.toThrow('equipo operativo');
    });
  });
});
