import { obtenerColaboradoresGestionados } from './autorizacion';

// Caso real: supervisor de equipo REPOSITOR → TeamLeader → impulsadores.
it('en equipos REPOSITOR incluye toda la cadena, no solo los directos', async () => {
  const niveles: Record<string, { id: number }[]> = {
    '285': [{ id: 286 }, { id: 258 }],
    '286,258': [{ id: 313 }, { id: 295 }],
  };
  const prisma = {
    usuario: {
      findUnique: jest.fn().mockResolvedValue({
        id: 285,
        empresaId: 1,
        isActive: true,
        rol: { equipoCampoId: 8 },
      }),
      findMany: jest.fn(
        ({ where }: { where: { superiorId: { in: number[] } } }) =>
          Promise.resolve(niveles[where.superiorId.in.join(',')] ?? []),
      ),
    },
  };
  const ids = await obtenerColaboradoresGestionados(prisma as never, {
    id: 285,
    empresaId: 1,
    equipoCampo: {
      id: 8,
      nombre: 'Hibridos_moderno',
      tipo: 'REPOSITOR',
      activo: true,
    } as never,
  });
  expect(ids.sort()).toEqual([258, 286, 295, 313]);
  // Cada nivel se limita al mismo equipo operativo y empresa del líder.
  expect(prisma.usuario.findMany.mock.calls[0][0].where).toMatchObject({
    empresaId: 1,
    isActive: true,
    rol: { equipoCampoId: 8 },
  });
});
