import { NotFoundException } from '@nestjs/common';
import { PlanificacionCampoService } from './planificacion-campo.service';
jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

function preparar() {
  const a = {
    id: 9,
    localId: 3,
    usuarioId: 4,
    fechaDesde: new Date('2026-10-01'),
    fechaHasta: null,
  };
  const tx = {
    asignacionCampo: {
      findFirst: jest.fn().mockResolvedValue(a),
      update: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
    usuario: {
      update: jest.fn(),
      updateMany: jest.fn(),
      // Líder 2 con el titular 4 a cargo.
      findUnique: jest.fn().mockResolvedValue({
        id: 2,
        empresaId: 10,
        isActive: true,
        rol: { equipoCampoId: 1 },
      }),
      findMany: jest.fn(
        ({ where }: { where: { superiorId: { in: number[] } } }) =>
          Promise.resolve(where.superiorId.in.includes(2) ? [{ id: 4 }] : []),
      ),
    },
  };
  const prisma = {
    ...tx,
    $transaction: jest.fn((fn: (client: typeof tx) => unknown) => fn(tx)),
  };
  const acceso = {
    gestionar: jest.fn().mockResolvedValue({
      id: 2,
      empresaId: 10,
      equipoCampo: {
        id: 1,
        nombre: 'Impulsadores',
        tipo: 'IMPULSADOR',
        activo: true,
      },
    }),
  };
  // Las altas y ediciones pasan por administrar(), que valida igual que gestionar().
  Object.assign(acceso, {
    administrar: jest.fn((usuarioId: number, pagina: string): unknown =>
      acceso.gestionar(usuarioId, pagina),
    ),
  });
  return {
    tx,
    prisma,
    servicio: new PlanificacionCampoService(prisma as never, acceso as never),
  };
}
it('solo permite elegir el local del titular del equipo y la empresa del actor', async () => {
  const { tx, prisma, servicio } = preparar();
  await servicio.localPrincipal(2, 9, true);
  expect(tx.asignacionCampo.findFirst).toHaveBeenLastCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        id: 9,
        localId: 3,
        usuarioId: 4,
        usuario: {
          id: { in: [4] },
          empresaId: 10,
          isActive: true,
          rol: { equipoCampoId: 1 },
        },
        local: {
          activo: true,
          empresaId: 10,
          eliminadoEn: null,
          AND: [
            {
              OR: [
                { clienteId: null },
                { cliente: { activo: true, eliminadoEn: null } },
              ],
            },
          ],
        },
      }) as unknown,
    }),
  );
  expect(tx.usuario.update).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { id: 4 },
      data: { localPrincipalId: 3 },
    }),
  );
  expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
    isolationLevel: 'Serializable',
  });
});
it('rechaza una asignación fuera del equipo sin modificar la preferencia', async () => {
  const { tx, servicio } = preparar();
  tx.asignacionCampo.findFirst.mockResolvedValueOnce(null);
  await expect(servicio.localPrincipal(2, 9, true)).rejects.toThrow(
    NotFoundException,
  );
  expect(tx.usuario.update).not.toHaveBeenCalled();
});
it('quitar la selección solo borra la preferencia si sigue siendo este local', async () => {
  const { tx, servicio } = preparar();
  await servicio.localPrincipal(2, 9, false);
  expect(tx.usuario.updateMany).toHaveBeenCalledWith({
    where: { id: 4, empresaId: 10, localPrincipalId: 3 },
    data: { localPrincipalId: null },
  });
});
it('conserva el principal si queda otra asignación activa del mismo local', async () => {
  const { tx, servicio } = preparar();
  tx.asignacionCampo.count.mockResolvedValue(1);
  await servicio.quitarAsignacion(2, 9);
  expect(tx.usuario.updateMany).not.toHaveBeenCalled();
  tx.asignacionCampo.count.mockResolvedValue(0);
  await servicio.quitarAsignacion(2, 9);
  expect(tx.usuario.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({ data: { localPrincipalId: null } }),
  );
});
