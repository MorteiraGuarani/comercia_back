import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { RolesService } from './roles.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('RolesService', () => {
  const prisma = {
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
    usuario: { findUnique: jest.fn() },
    empresa: { findUnique: jest.fn() },
    empresaModulo: { count: jest.fn() },
    empresaPagina: { count: jest.fn() },
    rol: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
  const service = new RolesService(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
      fn(prisma),
    );
    prisma.usuario.findUnique.mockResolvedValue({
      esSuperadmin: true,
      isActive: true,
    });
    prisma.empresa.findUnique.mockResolvedValue({ id: 20 });
    prisma.empresaModulo.count.mockResolvedValue(0);
    prisma.empresaPagina.count.mockResolvedValue(0);
  });

  it('pagina los roles y expone sólo el DTO administrativo', async () => {
    prisma.rol.count.mockResolvedValue(8);
    prisma.rol.findMany.mockResolvedValue([
      {
        id: 3,
        empresa: { id: 20, nombre: 'Empresa A' },
        descripcion: 'Supervisor',
        padre: { id: 1, descripcion: 'Gerencia' },
        _count: { usuarios: 4, hijos: 1 },
      },
    ]);

    await expect(
      service.listar(1, { empresaId: 20, page: 2, limit: 7 }),
    ).resolves.toEqual({
      items: [
        {
          id: 3,
          empresa: { id: 20, nombre: 'Empresa A' },
          descripcion: 'Supervisor',
          padre: { id: 1, descripcion: 'Gerencia' },
          usuariosCount: 4,
          hijosCount: 1,
          equipoCampo: null,
        },
      ],
      total: 8,
      page: 2,
      limit: 7,
      totalPages: 2,
    });
    expect(prisma.rol.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { empresaId: 20 }, skip: 7, take: 7 }),
    );
  });

  it('rechaza eliminar un rol con usuarios o subordinados', async () => {
    prisma.rol.findUnique.mockResolvedValue({
      id: 3,
      _count: { usuarios: 1, hijos: 0 },
    });

    await expect(service.eliminar(1, 3)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.rol.delete).not.toHaveBeenCalled();
  });

  it('rechaza asignar el propio rol como superior', async () => {
    prisma.rol.findUnique.mockResolvedValue({ id: 3, empresaId: 20 });

    await expect(service.actualizar(1, 3, { rolId: 3 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.rol.update).not.toHaveBeenCalled();
  });
  it('rechaza las operaciones sin superadmin incluso al llamar al servicio', async () => {
    prisma.usuario.findUnique.mockResolvedValue({
      esSuperadmin: false,
      isActive: true,
    });
    await expect(
      service.crear(1, { empresaId: 20, descripcion: 'Gerente' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.actualizar(1, 3, {})).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.eliminar(1, 3)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.listar(1, {})).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.rol.create).not.toHaveBeenCalled();
  });

  it('crea el rol dentro de la empresa indicada', async () => {
    prisma.rol.create.mockResolvedValue({
      id: 7,
      descripcion: 'Gerente',
      empresa: { id: 20, nombre: 'Empresa A' },
      padre: null,
      _count: { usuarios: 0, hijos: 0 },
    });
    await service.crear(1, { empresaId: 20, descripcion: 'Gerente' });
    expect(prisma.rol.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          empresaId: 20,
          descripcion: 'Gerente',
          rolId: null,
          equipoCampoId: null,
        },
      }),
    );
  });

  it('rechaza una empresa inexistente', async () => {
    prisma.empresa.findUnique.mockResolvedValue(null);
    await expect(
      service.crear(1, { empresaId: 99, descripcion: 'Gerente' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.rol.create).not.toHaveBeenCalled();
  });

  it('rechaza un superior de otra empresa al crear y editar', async () => {
    prisma.rol.findUnique.mockResolvedValue({ empresaId: 30, rolId: null });
    await expect(
      service.crear(1, { empresaId: 20, descripcion: 'Supervisor', rolId: 8 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    prisma.rol.findUnique.mockResolvedValueOnce({ id: 3, empresaId: 20 });
    await expect(service.actualizar(1, 3, { rolId: 8 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.rol.create).not.toHaveBeenCalled();
    expect(prisma.rol.update).not.toHaveBeenCalled();
  });

  it('rechaza ciclos indirectos en la jerarquia', async () => {
    prisma.rol.findUnique
      .mockResolvedValueOnce({ id: 3, empresaId: 20 })
      .mockResolvedValueOnce({ empresaId: 20, rolId: 5 })
      .mockResolvedValueOnce({ empresaId: 20, rolId: 3 });
    await expect(service.actualizar(1, 3, { rolId: 4 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.rol.update).not.toHaveBeenCalled();
  });

  it('traduce nombres duplicados por empresa a conflicto', async () => {
    prisma.rol.create.mockRejectedValue({ code: 'P2002' });
    await expect(
      service.crear(1, { empresaId: 20, descripcion: 'Gerente' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it.each(['empresaModulo', 'empresaPagina'] as const)(
    'impide borrar roles referenciados en %s',
    async (tabla) => {
      prisma.rol.findUnique.mockResolvedValue({
        id: 3,
        _count: { usuarios: 0, hijos: 0 },
      });
      prisma[tabla].count.mockResolvedValue(1);
      await expect(service.eliminar(1, 3)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.rol.delete).not.toHaveBeenCalled();
    },
  );
});
