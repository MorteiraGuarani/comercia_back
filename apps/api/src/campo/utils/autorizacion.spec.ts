import type { PrismaService } from '../../prisma/prisma.service';
import { esLiderDe, obtenerEquipoCompleto, obtenerLiderDirecto } from './autorizacion';

describe('jerarquía de campo', () => {
  const usuarios = [
    { id: 1, empresaId: 1, superiorId: null, isActive: true },
    { id: 2, empresaId: 1, superiorId: 1, isActive: true },
    { id: 3, empresaId: 1, superiorId: 2, isActive: true },
    { id: 4, empresaId: 1, superiorId: null, isActive: true },
    { id: 5, empresaId: 1, superiorId: 4, isActive: true },
    { id: 6, empresaId: 2, superiorId: 1, isActive: true },
  ];
  const prisma = {
    usuario: {
      findUnique: jest.fn().mockImplementation(({ where }: { where: { id: number } }) =>
        usuarios.find((u) => u.id === where.id) ?? null),
      findFirst: jest.fn().mockImplementation(({ where }: { where: { id: number; empresaId: number } }) =>
        usuarios.find((u) => u.id === where.id && u.empresaId === where.empresaId) ?? null),
      findMany: jest.fn().mockImplementation(({ where }: { where: { superiorId: { in: number[] }; empresaId: number } }) =>
        usuarios.filter((u) => u.superiorId !== null && where.superiorId.in.includes(u.superiorId) &&
          u.empresaId === where.empresaId && u.isActive).map(({ id }) => ({ id }))),
    },
  } as unknown as PrismaService;

  it('solo incluye la cadena real del supervisor', async () => {
    expect(await obtenerEquipoCompleto(prisma, 1)).toEqual([1, 2, 3]);
    expect(await esLiderDe(prisma, 1, 3)).toBe(true);
    expect(await esLiderDe(prisma, 1, 5)).toBe(false);
    expect(await esLiderDe(prisma, 1, 6)).toBe(false);
  });

  it('dirige notificaciones al superior asignado', async () => {
    expect(await obtenerLiderDirecto(prisma, 3)).toBe(2);
    expect(await obtenerLiderDirecto(prisma, 6)).toBeNull();
  });
});
