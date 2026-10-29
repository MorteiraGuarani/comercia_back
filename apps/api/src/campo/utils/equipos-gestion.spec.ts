import type { PrismaService } from '../../prisma/prisma.service';
import { obtenerEquipoCompleto } from './autorizacion';
import { alcanceDeGestor, filtroPersonalGestor } from './equipos-gestion';

const repositores = {
  id: 4,
  nombre: 'Repositores Mod',
  tipo: 'REPOSITOR' as const,
  activo: true,
};
const fila = (
  equipoGestion: typeof repositores | null,
  ids: number[],
  todos = false,
) => ({
  equipoGestion,
  rol: {
    equipoCampoId: null,
    gestionaTodosEquipos: todos,
    equiposGestion: ids.map((equipoCampoId) => ({ equipoCampoId })),
  },
});

describe('jefaturas de varios equipos', () => {
  it('solo es jefatura quien no tiene equipo propio y supervisa alguno', () => {
    expect(alcanceDeGestor(fila(null, []))).toBeNull();
    expect(
      alcanceDeGestor({
        ...fila(null, [2]),
        rol: { ...fila(null, [2]).rol, equipoCampoId: 2 },
      }),
    ).toBeNull();
    expect(alcanceDeGestor(fila(null, [2, 4]))).toEqual({
      todos: false,
      ids: [2, 4],
      activo: null,
    });
  });

  it('el equipo elegido vale solo si sigue entre los suyos', () => {
    expect(alcanceDeGestor(fila(repositores, [2]))?.activo).toBeNull();
    expect(alcanceDeGestor(fila(repositores, [2, 4]))?.activo).toBe(
      repositores,
    );
    expect(alcanceDeGestor(fila(repositores, [], true))?.activo).toBe(
      repositores,
    );
  });

  it('filtra el personal por el equipo elegido, sus equipos o todos', () => {
    expect(
      filtroPersonalGestor(1, { todos: false, ids: [2, 4], activo: null }).rol,
    ).toEqual({
      equipoCampo: { activo: true },
      equipoCampoId: { in: [2, 4] },
    });
    expect(
      filtroPersonalGestor(1, { todos: true, ids: [], activo: repositores })
        .rol,
    ).toEqual({
      equipoCampo: { activo: true },
      equipoCampoId: 4,
    });
    expect(
      filtroPersonalGestor(1, { todos: true, ids: [], activo: null }).rol,
    ).toEqual({
      equipoCampo: { activo: true },
    });
  });

  it('el equipo completo de la jefatura es el personal de sus equipos', async () => {
    const prisma = {
      usuario: {
        findUnique: jest.fn().mockResolvedValue({
          id: 9,
          empresaId: 1,
          isActive: true,
          ...fila(null, [2, 4]),
        }),
        findMany: jest.fn().mockResolvedValue([{ id: 20 }, { id: 30 }]),
      },
    };
    await expect(
      obtenerEquipoCompleto(prisma as unknown as PrismaService, 9),
    ).resolves.toEqual([9, 20, 30]);
    expect(prisma.usuario.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          empresaId: 1,
          id: { not: 9 },
          rol: { equipoCampo: { activo: true }, equipoCampoId: { in: [2, 4] } },
        }) as unknown,
      }),
    );
  });
});
