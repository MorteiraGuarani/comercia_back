import type { PrismaService } from '../../prisma/prisma.service';
import { obtenerSuperioresActivos } from './superiores';

describe('superiores del organigrama', () => {
  const personas = [
    { id: 1, empresaId: 10, superiorId: null, isActive: true },
    { id: 2, empresaId: 10, superiorId: 1, isActive: true },
    { id: 3, empresaId: 10, superiorId: 2, isActive: true },
    { id: 4, empresaId: 10, superiorId: 2, isActive: true },
    { id: 5, empresaId: 20, superiorId: 1, isActive: true },
    { id: 6, empresaId: 10, superiorId: 5, isActive: true },
    { id: 7, empresaId: 10, superiorId: 1, isActive: false },
    { id: 8, empresaId: 10, superiorId: 7, isActive: true },
    { id: 9, empresaId: 10, superiorId: 11, isActive: true },
    { id: 11, empresaId: 10, superiorId: 9, isActive: true },
  ];
  const db = {
    usuario: {
      findMany: jest.fn(
        ({ where }: { where: { empresaId: number; id: { in: number[] } } }) =>
          Promise.resolve(
            personas.filter(
              (u) =>
                u.empresaId === where.empresaId && where.id.in.includes(u.id),
            ),
          ),
      ),
    },
  } as unknown as PrismaService;

  it('alcanza todos los niveles sin depender del rol y sin repetir líderes compartidos', async () => {
    expect(await obtenerSuperioresActivos(db, 10, [3, 4])).toEqual([2, 1]);
  });
  it('no cruza empresas ni acepta raíces ajenas', async () => {
    expect(await obtenerSuperioresActivos(db, 10, [5, 6])).toEqual([]);
  });
  it('omite inactivos y alcanza al superior activo que sigue', async () => {
    expect(await obtenerSuperioresActivos(db, 10, [8])).toEqual([1]);
  });
  it('termina ante ciclos y no envía al propio emisor', async () => {
    expect(await obtenerSuperioresActivos(db, 10, [9])).toEqual([11]);
    expect(await obtenerSuperioresActivos(db, 10, [])).toEqual([]);
  });
});
