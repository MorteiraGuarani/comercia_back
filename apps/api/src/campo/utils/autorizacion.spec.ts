import type { PrismaService } from '../../prisma/prisma.service';
import { esLiderDe } from './autorizacion';

describe('esLiderDe', () => {
  it('permite al líder de un nivel superior ver evidencias de su equipo', async () => {
    const prisma = {
      usuario: {
        findUnique: jest.fn().mockImplementation(({ where }: { where: { id: number } }) => {
          if (where.id === 3) return { empresaId: 1, rol: { rolId: 2, hijos: [] } };
          if (where.id === 1) return { empresaId: 1, rolId: 1, rol: { hijos: [{ usuarios: [{ id: 2 }] }] } };
          return { empresaId: 1, rolId: 2, rol: { hijos: [{ usuarios: [{ id: 3 }] }] } };
        }),
      },
    };
    expect(await esLiderDe(prisma as unknown as PrismaService, 1, 3)).toBe(true);
  });

  it('rechaza a líderes de otra empresa aunque compartan jerarquía de roles', async () => {
    const prisma = {
      usuario: {
        findUnique: jest.fn().mockImplementation(({ where }: { where: { id: number } }) =>
          where.id === 3
            ? { empresaId: 2, rol: { rolId: 1 } }
            : { empresaId: 1, rolId: 1 }),
      },
    };
    expect(await esLiderDe(prisma as unknown as PrismaService, 1, 3)).toBe(false);
  });
});
