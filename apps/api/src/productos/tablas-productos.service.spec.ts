import type { PrismaService } from '../prisma/prisma.service';
import type { ProductosService } from './productos.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

import { TablasProductosService } from './tablas-productos.service';
import { TABLAS_PRODUCTOS } from './tablas-productos';

describe('Bulk de tablas tbl_* que no se corta', () => {
  function armar() {
    const createMany = jest.fn(({ data }: { data: unknown[] }) => ({
      count: data.length - 1, // una ya existía
    }));
    const prisma = {
      empresa: { findUnique: jest.fn().mockResolvedValue({ id: 1 }) },
      producto: {
        findMany: jest.fn().mockResolvedValue([{ itemcode: 'A1' }]),
      },
      productoPrecio: { createMany },
      $queryRaw: jest.fn(),
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
      fn(prisma),
    );
    const servicio = new TablasProductosService(
      prisma as unknown as PrismaService,
      {} as ProductosService,
    );
    return { servicio, createMany, prisma };
  }

  it('en tbl_itm1 saltea los artículos inexistentes y suma las filas inválidas del pipe', async () => {
    const { servicio, createMany, prisma } = armar();
    const r = await servicio.crear(TABLAS_PRODUCTOS.tbl_itm1, 1, {
      recibidos: 5,
      filas: [
        { ItemCode: 'A1', PriceList: 1, Price: '10' },
        { ItemCode: 'NO', PriceList: 1, Price: '10' },
        { ItemCode: 'A1', PriceList: 2, Price: '11' },
        { ItemCode: 'A1', PriceList: 1, Price: '99' },
      ],
      indices: [0, 2, 3, 4],
      invalidas: [
        {
          index: 1,
          fila: 2,
          errores: [],
          motivo: 'Price = "": inválido',
          details: 'x',
        },
      ],
    });
    expect(prisma.producto.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { empresaId: 1, itemcode: { in: ['A1', 'NO'] } },
      }),
    );
    expect(createMany.mock.calls[0][0].data).toHaveLength(2);
    expect(r).toMatchObject({
      recibidos: 5,
      insertados: 1,
      existentes: 1,
      duplicadosEnLote: 1,
      omitidos: 2,
      invalidas: 2,
    });
    // recibidos = insertados + omitidos + invalidas
    expect(
      (r as { filasInvalidas: { fila: number; motivo: string }[] })
        .filasInvalidas,
    ).toEqual([
      expect.objectContaining({ fila: 2 }),
      expect.objectContaining({
        fila: 3,
        motivo: expect.stringContaining('no existe en tbl_oitm') as unknown,
      }),
    ]);
  });
});
