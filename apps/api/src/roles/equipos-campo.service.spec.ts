import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { DestinatarioTareaCampo } from '../../generated/prisma/client';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));
import { RolesService } from './roles.service';

function contexto() {
  const grupos = [
    {
      id: 2,
      empresaId: 10,
      nombre: 'Equipo propio',
      tipo: DestinatarioTareaCampo.REPOSITOR,
      activo: true,
    },
    {
      id: 3,
      empresaId: 20,
      nombre: 'Equipo ajeno',
      tipo: DestinatarioTareaCampo.REPOSITOR,
      activo: true,
    },
  ];
  const prisma = {
    usuario: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ esSuperadmin: true, isActive: true }),
    },
    empresa: { findUnique: jest.fn().mockResolvedValue({ id: 10 }) },
    $queryRaw: jest.fn(),
    visitaCampo: { count: jest.fn().mockResolvedValue(0) },
    equipoCampo: {
      count: jest.fn().mockResolvedValue(1),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockImplementation(
        ({
          where,
        }: {
          where: {
            id?: number;
            empresaId: number;
            nombre?: { equals: string };
          };
        }) =>
          grupos.find(
            (g) =>
              g.empresaId === where.empresaId &&
              (where.id
                ? g.id === where.id
                : g.nombre.toLowerCase() ===
                  where.nombre?.equals.toLowerCase()),
          ) ?? null,
      ),
      create: jest.fn().mockResolvedValue({ id: 4 }),
    },
    rol: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ id: 8, empresaId: 10, equipoCampoId: 2 }),
      create: jest.fn().mockResolvedValue({
        id: 8,
        descripcion: 'Cargo nuevo',
        empresa: { id: 10, nombre: 'Empresa' },
        padre: null,
        equipoCampo: null,
        _count: { usuarios: 0, hijos: 0 },
      }),
      update: jest.fn().mockResolvedValue({
        id: 8,
        descripcion: 'Nombre nuevo',
        empresa: { id: 10, nombre: 'Empresa' },
        padre: null,
        equipoCampo: grupos[0],
        _count: { usuarios: 1, hijos: 0 },
      }),
    },
    $transaction: jest
      .fn()
      .mockImplementation((fn: (tx: unknown) => unknown) => fn(prisma)),
  };
  return {
    prisma,
    service: new RolesService(prisma as unknown as PrismaService),
  };
}

describe('Equipos operativos configurables', () => {
  it('permite un nombre de rol arbitrario dentro de un equipo configurado', async () => {
    const { service, prisma } = contexto();
    await service.crear(1, {
      empresaId: 10,
      descripcion: 'Mercaderista Auxiliar',
      equipoCampoId: 2,
    });
    expect(prisma.rol.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          empresaId: 10,
          descripcion: 'Mercaderista Auxiliar',
          rolId: null,
          equipoCampoId: 2,
          permisosTareas: [],
          puedeVerSeguimiento: false,
        },
      }),
    );
  });

  it('no acepta equipos de otra empresa', async () => {
    const { service, prisma } = contexto();
    await expect(
      service.crear(1, {
        empresaId: 10,
        descripcion: 'Auxiliar',
        equipoCampoId: 3,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.rol.create).not.toHaveBeenCalled();
  });

  it('crea el equipo y su primer rol en la misma transacción', async () => {
    const { service, prisma } = contexto();
    await service.crear(1, {
      empresaId: 10,
      descripcion: 'Supervisor Norte',
      nuevoEquipoNombre: 'Equipo Norte',
      nuevoEquipoTipo: DestinatarioTareaCampo.REPOSITOR,
    });
    expect(prisma.equipoCampo.create).toHaveBeenCalledWith({
      data: { empresaId: 10, nombre: 'Equipo Norte', tipo: 'REPOSITOR' },
      select: { id: true },
    });
    expect(prisma.rol.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          empresaId: 10,
          descripcion: 'Supervisor Norte',
          rolId: null,
          equipoCampoId: 4,
          permisosTareas: [],
          puedeVerSeguimiento: false,
        },
      }),
    );
  });

  it('no crea duplicados de equipo por mayúsculas', async () => {
    const { service, prisma } = contexto();
    await expect(
      service.crear(1, {
        empresaId: 10,
        descripcion: 'Auxiliar',
        nuevoEquipoNombre: 'EQUIPO PROPIO',
        nuevoEquipoTipo: DestinatarioTareaCampo.REPOSITOR,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.rol.create).not.toHaveBeenCalled();
    expect(prisma.equipoCampo.create).not.toHaveBeenCalled();
  });

  it('renombrar un rol conserva su equipo', async () => {
    const { service, prisma } = contexto();
    await service.actualizar(1, 8, { descripcion: 'Cualquier nombre' });
    expect(prisma.rol.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { descripcion: 'Cualquier nombre', equipoCampoId: 2 },
      }),
    );
    expect(prisma.visitaCampo.count).not.toHaveBeenCalled();
  });

  it('no cambia la planificación en medio de visitas abiertas', async () => {
    const { service, prisma } = contexto();
    prisma.visitaCampo.count.mockResolvedValue(1);
    await expect(
      service.actualizar(1, 8, { equipoCampoId: null }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.rol.update).not.toHaveBeenCalled();
  });

  it('exige permisos administrativos también para consultar equipos', async () => {
    const { service, prisma } = contexto();
    prisma.usuario.findUnique.mockResolvedValue({
      esSuperadmin: false,
      isActive: true,
    });
    await expect(service.equipos(1, { empresaId: 10 })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.equipoCampo.findMany).not.toHaveBeenCalled();
  });
});
