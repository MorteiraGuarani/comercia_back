import type { PrismaService } from '../prisma/prisma.service';
import type { CampoAccesoService } from './campo-acceso.service';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));
import { CatalogoCampoService } from './catalogo-campo.service';
import { restringirItinerarioAlEquipo } from './utils/alcance-itinerario';

function preparar(
  rolDescripcion = 'supervisor.impulsador',
  colaboradores = true,
) {
  const prisma = {
    usuario: {
      count: jest.fn().mockResolvedValue(0),
      findUnique: jest.fn().mockResolvedValue({
        id: 1,
        empresaId: 10,
        isActive: true,
        rol: { equipoCampoId: 4 },
      }),
      findMany: jest
        .fn()
        .mockResolvedValueOnce(colaboradores ? [{ id: 2 }] : [])
        .mockResolvedValueOnce([{ id: 3 }])
        .mockResolvedValue([]),
    },
    socioNegocio: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
  const acceso = {
    gestionar: jest.fn().mockResolvedValue({
      id: 1,
      empresaId: 10,
      rolDescripcion,
      equipoCampo: { id: 4, tipo: 'IMPULSADOR', activo: true },
    }),
  };
  return {
    prisma,
    service: new CatalogoCampoService(
      prisma as unknown as PrismaService,
      acceso as unknown as CampoAccesoService,
    ),
  };
}

describe('Alcance de Itinerario del supervisor impulsador', () => {
  it.each(['locales', 'localesMapa'] as const)(
    '%s limita catálogo, conteo y asignados a la cadena real del equipo',
    async (metodo) => {
      const { prisma, service } = preparar();
      await service[metodo](1, { page: 2, limit: 7, buscar: 'central' });
      const personal = {
        empresaId: 10,
        id: { in: [2, 3] },
        isActive: true,
        esSuperadmin: false,
        rol: { equipoCampoId: 4 },
      };
      const asignacion = {
        activo: true,
        usuario: personal,
        fechaDesde: { lte: expect.any(Date) as unknown },
        OR: [
          { fechaHasta: null },
          { fechaHasta: { gte: expect.any(Date) as unknown } },
        ],
      };
      const where: unknown = expect.objectContaining({
        empresaId: 10,
        OR: [
          { CardName: { contains: 'central', mode: 'insensitive' } },
          { CardCode: { contains: 'central', mode: 'insensitive' } },
        ],
        asignaciones: { some: asignacion },
      });
      expect(prisma.socioNegocio.count).toHaveBeenCalledWith({ where });
      expect(prisma.socioNegocio.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where,
          skip: 7,
          take: 7,
          select: expect.objectContaining({
            asignaciones: expect.objectContaining({
              where: asignacion,
            }) as unknown,
          }) as unknown,
        }),
      );
      expect(prisma.usuario.findMany).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: expect.objectContaining({
            empresaId: 10,
            superiorId: { in: [1] },
            rol: { equipoCampoId: 4 },
          }) as unknown,
        }),
      );
      expect(prisma.usuario.findMany).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: expect.objectContaining({
            superiorId: { in: [2] },
          }) as unknown,
        }),
      );
    },
  );

  it('filtra por la persona elegida y por un local, sin salir del equipo', async () => {
    const { prisma, service } = preparar();
    await service.locales(1, { usuarioId: 3, localId: 'L1' });
    expect(prisma.socioNegocio.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        CardCode: 'L1',
        AND: [
          {
            asignaciones: {
              some: expect.objectContaining({
                usuarioId: 3,
                usuario: expect.objectContaining({
                  id: { in: [2, 3] },
                }) as unknown,
              }) as unknown,
            },
          },
        ],
      }) as unknown,
    });
  });

  it('sugiere solo personas del equipo que atienden algún local hoy', async () => {
    const { prisma, service } = preparar();
    await service.colaboradoresLocales(1, { buscar: 'ana', limit: 5 });
    const where: unknown = expect.objectContaining({
      id: { in: [2, 3] },
      rol: { equipoCampoId: 4 },
      asignacionesCampo: {
        some: expect.not.objectContaining({
          usuario: expect.anything() as unknown,
        }) as unknown,
      },
      OR: expect.arrayContaining([
        { nombre: { contains: 'ana', mode: 'insensitive' } },
      ]) as unknown,
    });
    expect(prisma.usuario.count).toHaveBeenCalledWith({ where });
    expect(prisma.usuario.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where, take: 5 }),
    );
  });

  it('no convierte un supervisor sin colaboradores en acceso al catálogo completo', async () => {
    const { prisma, service } = preparar('supervisor.impulsador', false);
    await service.locales(1, {});
    expect(prisma.socioNegocio.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        asignaciones: {
          some: expect.objectContaining({
            usuario: expect.objectContaining({ id: { in: [] } }) as unknown,
          }) as unknown,
        },
      }) as unknown,
    });
  });

  it.each([
    'Back Office',
    'backoffice.impulsador',
    'SUPERVISOR_BACKOFFICE',
    'Administrador',
    'Superadmin',
  ])('%s conserva todos los locales de su empresa', async (rol) => {
    const { prisma, service } = preparar(rol);
    await service.locales(1, {});
    expect(prisma.socioNegocio.count).toHaveBeenCalledWith({
      where: { empresaId: 10 },
    });
    expect(prisma.usuario.findUnique).not.toHaveBeenCalled();
  });

  it.each([
    ['Supervisor', 'REPOSITOR', true],
    ['teamleader', 'REPOSITOR', true],
    ['supervisor.impulsador', 'IMPULSADOR', true],
    ['SUPERVISOR_BACKOFFICE', 'REPOSITOR', false],
    ['Administrador', 'REPOSITOR', false],
  ] as const)(
    '%s de un equipo %s ve solo los locales de su equipo: %s',
    (rolDescripcion, tipo, restringido) => {
      expect(
        restringirItinerarioAlEquipo({
          rolDescripcion,
          equipoCampo: { id: 4, nombre: 'Equipo', tipo, activo: true },
        }),
      ).toBe(restringido);
    },
  );

  it('sin equipo de campo conserva el catálogo completo', () => {
    expect(
      restringirItinerarioAlEquipo({
        rolDescripcion: 'Supervisor',
        equipoCampo: null,
      }),
    ).toBe(false);
  });

  it('el superadmin lista los locales de la empresa elegida sin recorte por equipo', async () => {
    const { prisma, service } = preparar();
    await service.localesEmpresa(25, { buscar: 'norte' });
    const where = {
      empresaId: 25,
      OR: [
        { CardName: { contains: 'norte', mode: 'insensitive' } },
        { CardCode: { contains: 'norte', mode: 'insensitive' } },
      ],
    };
    expect(prisma.socioNegocio.count).toHaveBeenCalledWith({ where });
    expect(prisma.socioNegocio.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where,
        select: expect.objectContaining({
          asignaciones: expect.objectContaining({
            where: expect.not.objectContaining({
              usuario: expect.anything() as unknown,
            }) as unknown,
          }) as unknown,
        }) as unknown,
      }),
    );
    expect(prisma.usuario.findMany).not.toHaveBeenCalled();
  });
});

describe('Administración del supervisor', () => {
  it('busca colaboradores también por código y lo muestra', async () => {
    const { prisma, service } = preparar();
    prisma.usuario.findMany
      .mockReset()
      .mockResolvedValueOnce([{ id: 2 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 2,
          nombre: 'Ana',
          apellido: 'Paz',
          nombreLogin: 'ana.paz',
          legajo: null,
          ERP_Repositor: 'R-15',
          ERP_Impulsador: null,
          rol: { descripcion: 'Repositor' },
        },
      ]);
    prisma.usuario.count.mockResolvedValue(1);
    const respuesta = await service.colaboradoresLocales(1, { buscar: 'R-15' });
    expect(respuesta.items).toEqual([
      { id: 2, nombre: 'Ana Paz', descripcion: 'Repositor', codigo: 'R-15' },
    ]);
    expect(prisma.usuario.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        OR: expect.arrayContaining([
          { ERP_Repositor: { contains: 'R-15', mode: 'insensitive' } },
        ]) as unknown,
      }) as unknown,
    });
  });

  it('ordena del local más cercano al más lejano y deja sin ubicación al final', async () => {
    const { prisma, service } = preparar();
    // Direcciones de CRD1: no participan del orden.
    Object.assign(prisma, { $queryRaw: jest.fn().mockResolvedValue([]) });
    const local = (
      CardCode: string,
      lat: string | null,
      lng: string | null,
    ) => ({
      CardCode,
      U_Latitud: lat,
      U_Longitud: lng,
    });
    prisma.socioNegocio.findMany
      // Puntos de todo el alcance para ordenar.
      .mockResolvedValueOnce([
        local('LEJOS', '-25.40', '-57.40'),
        local('SIN', null, null),
        local('CERCA', '-25.30', '-57.60'),
        local('MEDIO', '-25.35', '-57.55'),
      ])
      // Datos completos de la página, en cualquier orden.
      .mockResolvedValueOnce(
        ['MEDIO', 'CERCA'].map((CardCode) => ({
          CardCode,
          CardName: CardCode,
          asignaciones: [],
        })),
      );
    const respuesta = await service.locales(1, {
      lat: -25.3,
      lng: -57.6,
      page: 1,
      limit: 2,
    });
    expect(respuesta.total).toBe(4);
    expect(respuesta.items.map((l) => l.id)).toEqual(['CERCA', 'MEDIO']);
    expect(prisma.socioNegocio.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          AND: [expect.anything(), { CardCode: { in: ['CERCA', 'MEDIO'] } }],
        },
      }),
    );
    expect(prisma.socioNegocio.count).not.toHaveBeenCalled();
  });
});
