import { Logger } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { VencimientosService } from './vencimientos.service';

function preparar() {
  const personas = [
    { id: 1, empresaId: 10, superiorId: null, isActive: true },
    { id: 2, empresaId: 10, superiorId: 1, isActive: true },
    { id: 3, empresaId: 10, superiorId: 2, isActive: true },
    { id: 4, empresaId: 10, superiorId: 2, isActive: true },
  ];
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: 8 }]),
    cargaInventarioCampo: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 8,
          empresaId: 10,
          localId: 'L1',
          cantidad: 12,
          usuarioId: 3,
          vencimiento: new Date('2026-10-27'),
          producto: { itemcode: 'P1', itemname: 'Producto' },
          local: { CardCode: 'L1', CardName: 'Local' },
        },
      ]),
    },
    asignacionCampo: {
      findMany: jest
        .fn()
        .mockResolvedValue([{ usuarioId: 4 }, { usuarioId: 3 }]),
    },
    usuario: {
      findMany: jest.fn(
        ({
          where,
        }: {
          where: {
            empresaId: number;
            id: { in: number[] };
            isActive?: boolean;
          };
        }) =>
          Promise.resolve(
            personas.filter(
              (u) =>
                u.empresaId === where.empresaId &&
                where.id.in.includes(u.id) &&
                (!where.isActive || u.isActive),
            ),
          ),
      ),
    },
    notificacionCampo: {
      createMany: jest.fn(
        (args: { data: { usuarioDestinatarioId: number }[] }) =>
          Promise.resolve({ count: args.data.length }),
      ),
    },
  };
  const prisma = {
    $transaction: jest.fn((fn: (db: typeof tx) => Promise<number>) => fn(tx)),
  };
  return {
    tx,
    prisma,
    servicio: new VencimientosService(prisma as unknown as PrismaService),
  };
}

describe('avisos de vencimiento', () => {
  it('notifica al autor, asignados y todos los superiores una sola vez, dentro de la transacción', async () => {
    const { servicio, prisma, tx } = preparar();
    expect(await servicio.procesar()).toBe(1);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    const avisos = tx.notificacionCampo.createMany.mock.calls[0][0].data;
    expect(
      avisos
        .map((n: { usuarioDestinatarioId: number }) => n.usuarioDestinatarioId)
        .sort(),
    ).toEqual([1, 2, 3, 4]);
    expect(avisos[0]).toMatchObject({
      empresaId: 10,
      referenciaId: 8,
      tipo: 'VENCIMIENTO_PROXIMO',
    });
  });
  it('no crea avisos si no hay cargas pendientes', async () => {
    const { servicio, tx } = preparar();
    tx.$queryRaw.mockResolvedValue([]);
    expect(await servicio.procesar()).toBe(0);
    expect(tx.notificacionCampo.createMany).not.toHaveBeenCalled();
  });
  it('propaga el fallo al límite transaccional para que la marca se revierta', async () => {
    const { servicio, prisma, tx } = preparar();
    tx.notificacionCampo.createMany.mockRejectedValue(
      new Error('Sin conexión'),
    );
    const log = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    expect(await servicio.procesar()).toBe(0);
    await expect(prisma.$transaction.mock.results[0].value).rejects.toThrow(
      'Sin conexión',
    );
    log.mockRestore();
  });
});
