import type { PrismaService } from '../../prisma/prisma.service';
import {
  esLiderDe,
  obtenerEquipoCompleto,
  obtenerLiderDirecto,
} from './autorizacion';

describe('jerarquía de campo', () => {
  const usuarios = [
    {
      id: 1,
      empresaId: 1,
      superiorId: null,
      isActive: true,
      rol: { equipoCampoId: 1 },
    },
    {
      id: 2,
      empresaId: 1,
      superiorId: 1,
      isActive: true,
      rol: { equipoCampoId: 1 },
    },
    {
      id: 3,
      empresaId: 1,
      superiorId: 2,
      isActive: true,
      rol: { equipoCampoId: 1 },
    },
    {
      id: 4,
      empresaId: 1,
      superiorId: null,
      isActive: true,
      rol: { equipoCampoId: 1 },
    },
    {
      id: 5,
      empresaId: 1,
      superiorId: 4,
      isActive: true,
      rol: { equipoCampoId: 1 },
    },
    {
      id: 6,
      empresaId: 2,
      superiorId: 1,
      isActive: true,
      rol: { equipoCampoId: 1 },
    },
    {
      id: 7,
      empresaId: 1,
      superiorId: 2,
      isActive: true,
      rol: { equipoCampoId: 2 },
    },
  ];
  const prisma = {
    usuario: {
      findUnique: jest
        .fn()
        .mockImplementation(
          ({ where }: { where: { id: number } }) =>
            usuarios.find((u) => u.id === where.id) ?? null,
        ),
      findFirst: jest.fn().mockImplementation(
        ({
          where,
        }: {
          where: {
            id: number;
            empresaId: number;
            rol?: { equipoCampoId: number };
          };
        }) =>
          usuarios.find(
            (u) =>
              u.id === where.id &&
              u.empresaId === where.empresaId &&
              (!where.rol || u.rol.equipoCampoId === where.rol.equipoCampoId),
          ) ?? null,
      ),
      findMany: jest.fn().mockImplementation(
        ({
          where,
        }: {
          where: {
            superiorId: { in: number[] };
            empresaId: number;
            rol?: { equipoCampoId: number };
          };
        }) =>
          usuarios
            .filter(
              (u) =>
                u.superiorId !== null &&
                where.superiorId.in.includes(u.superiorId) &&
                u.empresaId === where.empresaId &&
                u.isActive &&
                (!where.rol || u.rol.equipoCampoId === where.rol.equipoCampoId),
            )
            .map(({ id }) => ({ id })),
      ),
    },
  } as unknown as PrismaService;

  it('solo incluye la cadena real del supervisor', async () => {
    expect(await obtenerEquipoCompleto(prisma, 1)).toEqual([1, 2, 3]);
    expect(await esLiderDe(prisma, 1, 3)).toBe(true);
    expect(await esLiderDe(prisma, 1, 5)).toBe(false);
    expect(await esLiderDe(prisma, 1, 6)).toBe(false);
    expect(await esLiderDe(prisma, 1, 7)).toBe(false);
  });

  it('dirige notificaciones al superior asignado', async () => {
    expect(await obtenerLiderDirecto(prisma, 3)).toBe(2);
    expect(await obtenerLiderDirecto(prisma, 6)).toBeNull();
    expect(await obtenerLiderDirecto(prisma, 7)).toBeNull();
  });
});
