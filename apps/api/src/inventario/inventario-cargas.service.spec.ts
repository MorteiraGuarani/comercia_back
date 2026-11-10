import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { AccesoPlataformaService } from '../plataforma/acceso-plataforma.service';
import type { PrismaService } from '../prisma/prisma.service';
import { InventarioCargasService } from './inventario-cargas.service';
import { estadoCarga } from './utils/estado-carga';
import {
  obtenerPersonalJefatura,
  obtenerSubordinadosActivos,
} from '../campo/utils/autorizacion';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));
jest.mock('../campo/utils/autorizacion', () => ({
  obtenerPersonalJefatura: jest.fn(),
  obtenerSubordinadosActivos: jest.fn(),
}));

describe('InventarioCargasService', () => {
  const prisma = {
    usuario: { findUnique: jest.fn() },
    empresa: {
      count: jest.fn().mockResolvedValue(1),
      findMany: jest
        .fn()
        .mockResolvedValue([{ id: 2, diasAvisoVencimiento: 10 }]),
    },
    producto: { findMany: jest.fn().mockResolvedValue([]) },
    cargaInventarioCampo: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
  const plataforma = {
    exigirAccesoPagina: jest.fn().mockResolvedValue({ id: 5, empresaId: 2 }),
  };
  const servicio = new InventarioCargasService(
    prisma as unknown as PrismaService,
    plataforma as unknown as AccesoPlataformaService,
  );
  const where = () =>
    (
      prisma.cargaInventarioCampo.count.mock.calls.at(-1) as [
        { where: Record<string, unknown> },
      ]
    )[0].where;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.usuario.findUnique.mockResolvedValue({
      isActive: true,
      esSuperadmin: false,
      rol: { descripcion: 'Supervisor', esAdminTi: false },
    });
    (obtenerPersonalJefatura as jest.Mock).mockResolvedValue([6, 7]);
    (obtenerSubordinadosActivos as jest.Mock).mockResolvedValue([7, 8]);
  });

  it('exige la página y limita a lo propio y su cadena', async () => {
    await servicio.listar(5, { desde: '2026-11-01', hasta: '2026-11-09' });
    expect(plataforma.exigirAccesoPagina).toHaveBeenCalledWith(
      5,
      'inventarios',
      'cargas',
    );
    expect(where()).toMatchObject({
      empresaId: 2,
      usuarioId: { in: [5, 6, 7] },
    });
  });

  it('el superadmin ve todas las empresas sin exigir la página', async () => {
    prisma.usuario.findUnique.mockResolvedValue({
      isActive: true,
      esSuperadmin: true,
      rol: null,
    });
    await servicio.listar(5, {});
    expect(plataforma.exigirAccesoPagina).not.toHaveBeenCalled();
    expect(where()).not.toHaveProperty('empresaId');
    expect(where()).not.toHaveProperty('usuarioId');
    await servicio.listar(5, { empresaId: 9 });
    expect(where()).toMatchObject({ empresaId: 9 });
  });

  it('el superadmin debe elegir empresa para filtrar por persona', async () => {
    prisma.usuario.findUnique.mockResolvedValue({
      isActive: true,
      esSuperadmin: true,
      rol: null,
    });
    await expect(
      servicio.listar(5, { responsableId: 6 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('Admin TI ve toda su empresa y no puede pedir otra', async () => {
    prisma.usuario.findUnique.mockResolvedValue({
      isActive: true,
      esSuperadmin: false,
      rol: { descripcion: 'AdminTI', esAdminTi: true },
    });
    await servicio.listar(5, { empresaId: 9 });
    expect(where()).toMatchObject({ empresaId: 2 });
    expect(where()).not.toHaveProperty('usuarioId');
  });

  it('otros roles no reciben empresas para elegir', async () => {
    await expect(servicio.empresas(5, {})).resolves.toMatchObject({
      items: [],
      total: 0,
    });
    expect(prisma.empresa.count).not.toHaveBeenCalled();
  });

  it('no deja pedir un responsable fuera del alcance', async () => {
    await expect(
      servicio.listar(5, { responsableId: 99 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.cargaInventarioCampo.count).not.toHaveBeenCalled();
  });

  it('un responsable trae su cadena, recortada al alcance', async () => {
    await servicio.listar(5, { responsableId: 6 });
    // 8 depende de 6 pero no está en el alcance de la sesión.
    expect(where()).toMatchObject({ usuarioId: { in: [6, 7] } });
  });

  it('estado: mismo plazo que los avisos', () => {
    expect(estadoCarga(-1, 10)).toBe('VENCIDO');
    expect(estadoCarga(0, 10)).toBe('POR_VENCER');
    expect(estadoCarga(10, 10)).toBe('POR_VENCER');
    expect(estadoCarga(11, 10)).toBe('VIGENTE');
  });
});
