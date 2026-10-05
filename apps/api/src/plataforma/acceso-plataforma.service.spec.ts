import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { AccesoPlataformaService } from './acceso-plataforma.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('AccesoPlataformaService', () => {
  const prisma = {
    usuario: { findUnique: jest.fn() },
    modulo: { findUnique: jest.fn() },
    empresaModulo: { findMany: jest.fn(), findUnique: jest.fn() },
    empresaPagina: { findMany: jest.fn(), findUnique: jest.fn() },
  };
  const service = new AccesoPlataformaService(
    prisma as unknown as PrismaService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.usuario.findUnique.mockResolvedValue({
      id: 10,
      empresaId: 20,
      rolId: 5,
      isActive: true,
      rol: null,
    });
    prisma.empresaPagina.findMany.mockResolvedValue([]);
  });

  it('autoriza una página completa del módulo Supervisor', async () => {
    prisma.empresaModulo.findMany.mockResolvedValue([
      {
        todasLasPaginas: true,
        rolIds: [5],
        modulo: { ruta: 'supervisor', paginas: [{ id: 100 }] },
      },
    ]);

    await expect(
      service.exigirAccesoAlgunaPaginaEnModulos(
        10,
        ['supervisor', 'repositor'],
        ['mapa'],
      ),
    ).resolves.toEqual({
      id: 10,
      empresaId: 20,
      rolId: 5,
      rolDescripcion: null,
      equipoCampo: null,
      permisosTareas: [],
      puedeVerSeguimiento: false,
    });
  });

  it('rechaza una página apagada aunque la empresa tenga todo el módulo', async () => {
    prisma.modulo.findUnique.mockResolvedValue({
      id: 8,
      activo: true,
      paginas: [{ id: 15, activo: false }],
    });

    await expect(
      service.exigirAccesoPagina(10, 'repositor', 'clientes'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.empresaModulo.findUnique).not.toHaveBeenCalled();
  });

  it('autoriza una página específica del módulo Repositor', async () => {
    prisma.empresaModulo.findMany.mockResolvedValue([
      {
        todasLasPaginas: false,
        rolIds: [5],
        modulo: { ruta: 'repositor', paginas: [{ id: 200 }] },
      },
    ]);
    prisma.empresaPagina.findMany.mockResolvedValue([
      { paginaId: 200, rolIds: [5] },
    ]);

    await expect(
      service.exigirAccesoAlgunaPaginaEnModulos(
        10,
        ['supervisor', 'repositor'],
        ['clientes'],
      ),
    ).resolves.toEqual({
      id: 10,
      empresaId: 20,
      rolId: 5,
      rolDescripcion: null,
      equipoCampo: null,
      permisosTareas: [],
      puedeVerSeguimiento: false,
    });
  });

  it('rechaza cuando el rol no puede ver el módulo', async () => {
    prisma.empresaModulo.findMany.mockResolvedValue([
      {
        todasLasPaginas: true,
        rolIds: [6],
        modulo: { ruta: 'repositor', paginas: [{ id: 200 }] },
      },
    ]);

    await expect(
      service.exigirAccesoAlgunaPaginaEnModulos(
        10,
        ['supervisor', 'repositor'],
        ['clientes'],
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rechaza usuarios inactivos antes de consultar asignaciones', async () => {
    prisma.usuario.findUnique.mockResolvedValue({
      id: 10,
      empresaId: 20,
      rolId: 5,
      isActive: false,
    });

    await expect(
      service.exigirAccesoAlgunaPaginaEnModulos(
        10,
        ['supervisor', 'repositor'],
        ['clientes'],
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.empresaModulo.findMany).not.toHaveBeenCalled();
  });

  it('informa cada módulo que autoriza la funcionalidad compartida', async () => {
    prisma.empresaModulo.findMany.mockResolvedValue([
      {
        todasLasPaginas: true,
        rolIds: [5],
        modulo: { ruta: 'supervisor', paginas: [{ id: 100 }] },
      },
      {
        todasLasPaginas: false,
        rolIds: [5],
        modulo: { ruta: 'repositor', paginas: [{ id: 200 }] },
      },
    ]);
    prisma.empresaPagina.findMany.mockResolvedValue([
      { paginaId: 200, rolIds: [5] },
    ]);

    await expect(
      service.exigirAccesosPaginasEnModulos(
        10,
        ['supervisor', 'repositor'],
        ['clientes'],
      ),
    ).resolves.toEqual({
      usuario: {
        id: 10,
        empresaId: 20,
        rolId: 5,
        rolDescripcion: null,
        equipoCampo: null,
        permisosTareas: [],
        puedeVerSeguimiento: false,
      },
      modulosRutas: ['supervisor', 'repositor'],
    });
  });
});
