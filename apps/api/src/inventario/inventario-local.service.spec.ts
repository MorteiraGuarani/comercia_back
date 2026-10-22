import {
  BadRequestException,
  PayloadTooLargeException,
} from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import type { AccesoPlataformaService } from '../plataforma/acceso-plataforma.service';
import type { VencimientosService } from './vencimientos.service';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));
import { InventarioLocalService } from './inventario-local.service';
import { relojCampo } from '../campo/utils/calendario';

const diaRelativo = (dias: number) =>
  new Date(Date.parse(`${relojCampo().fecha}T00:00:00Z`) + dias * 86_400_000)
    .toISOString()
    .slice(0, 10);

function contexto(asociados: number) {
  const tx = {
    cargaInventarioCampo: {
      // Hoy ya había una carga de A1 con vencimiento 2026-11-01.
      findMany: jest
        .fn()
        .mockResolvedValue([
          { itemcode: 'A1', vencimiento: new Date('2026-11-01T00:00:00Z') },
        ]),
      upsert: jest.fn().mockResolvedValue({ id: 1 }),
    },
  };
  const prisma = {
    socioNegocio: {
      findFirst: jest
        .fn()
        .mockResolvedValue({ CardCode: 'C1', CardName: 'Día' }),
    },
    productoLocalCampo: { count: jest.fn().mockResolvedValue(asociados) },
    $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  const plataforma = {
    exigirAccesoPagina: jest.fn().mockResolvedValue({ empresaId: 10 }),
  };
  const vencimientos = { procesar: jest.fn().mockResolvedValue(0) };
  const servicio = new InventarioLocalService(
    prisma as unknown as PrismaService,
    plataforma as unknown as AccesoPlataformaService,
    vencimientos as unknown as VencimientosService,
  );
  return { servicio, tx, prisma, plataforma, vencimientos };
}

describe('Inventario por local · carga de hoy', () => {
  it('exige el permiso de Mi jornada · Inventario y que el producto esté en el local', async () => {
    const { servicio, plataforma, tx } = contexto(0);
    await expect(
      servicio.guardarCargas(7, 'C1', {
        cargas: [{ itemcode: 'Z9', cantidad: 1, vencimiento: '2026-11-01' }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(plataforma.exigirAccesoPagina).toHaveBeenCalledWith(
      7,
      'mi-jornada',
      'inventario',
    );
    expect(tx.cargaInventarioCampo.upsert).not.toHaveBeenCalled();
  });

  it('un vencimiento nuevo vuelve a habilitar el aviso; uno igual no', async () => {
    const { servicio, tx, vencimientos } = contexto(2);
    await servicio.guardarCargas(7, 'C1', {
      cargas: [
        { itemcode: 'A1', cantidad: 5, vencimiento: '2026-11-01' },
        { itemcode: 'B2', cantidad: 3, vencimiento: '2026-10-25' },
      ],
    });
    const [igual, nueva] = tx.cargaInventarioCampo.upsert.mock.calls.map(
      (c: [{ update: object; create: object }]) => c[0],
    );
    expect(igual.update).not.toHaveProperty('avisadoEn');
    expect(nueva.update).toHaveProperty('avisadoEn', null);
    expect(nueva.create).toMatchObject({
      empresaId: 10,
      localId: 'C1',
      itemcode: 'B2',
      cantidad: 3,
      usuarioId: 7,
    });
    expect(vencimientos.procesar).toHaveBeenCalled();
  });

  it('rechaza productos repetidos en la misma carga', async () => {
    const { servicio } = contexto(1);
    await expect(
      servicio.guardarCargas(7, 'C1', {
        cargas: [
          { itemcode: 'A1', cantidad: 1, vencimiento: '2026-11-01' },
          { itemcode: 'A1', cantidad: 2, vencimiento: '2026-11-02' },
        ],
      }),
    ).rejects.toThrow('repetidos');
  });

  it('una carga hecha sin conexión conserva su día, hasta 7 días atrás', async () => {
    const { servicio, tx } = contexto(1);
    const ayer = diaRelativo(-1);
    await servicio.guardarCargas(7, 'C1', {
      fecha: ayer,
      cargas: [{ itemcode: 'A1', cantidad: 1, vencimiento: '2026-11-01' }],
    });
    expect(
      (
        tx.cargaInventarioCampo.upsert.mock.calls[0] as [
          { create: { fecha: Date } },
        ]
      )[0].create.fecha.toISOString(),
    ).toBe(`${ayer}T00:00:00.000Z`);
    for (const fecha of [diaRelativo(1), diaRelativo(-8)])
      await expect(
        servicio.guardarCargas(7, 'C1', {
          fecha,
          cargas: [{ itemcode: 'A1', cantidad: 1, vencimiento: '2026-11-01' }],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('Inventario por local · copia sin conexión', () => {
  function copia(productos = 1) {
    const prisma = {
      empresa: {
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue({ diasAvisoVencimiento: 5 }),
      },
      producto: {
        findMany: jest.fn().mockResolvedValue(
          Array.from({ length: productos }, (_, i) => ({
            itemcode: `P${i}`,
            itemname: i ? `Producto ${i}` : null,
          })),
        ),
      },
      socioNegocio: {
        findMany: jest.fn().mockResolvedValue([
          { CardCode: 'C1', CardName: 'Uno' },
          { CardCode: 'C2', CardName: 'Dos' },
        ]),
      },
      productoLocalCampo: {
        findMany: jest.fn().mockResolvedValue([
          { localId: 'C1', itemcode: 'A1', producto: { itemname: 'Agua' } },
          { localId: 'C1', itemcode: 'B2', producto: { itemname: null } },
        ]),
      },
      cargaInventarioCampo: {
        findMany: jest.fn().mockResolvedValue([
          {
            localId: 'C1',
            itemcode: 'A1',
            cantidad: 4,
            vencimiento: new Date('2026-11-01T00:00:00Z'),
          },
        ]),
        groupBy: jest.fn().mockResolvedValue([
          { localId: 'C1', fecha: new Date('2026-10-20T00:00:00Z') },
          { localId: 'C1', fecha: new Date('2026-10-18T00:00:00Z') },
        ]),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    const servicio = new InventarioLocalService(
      prisma as unknown as PrismaService,
      {
        exigirAccesoPagina: jest.fn().mockResolvedValue({ empresaId: 10 }),
      } as unknown as AccesoPlataformaService,
      {} as VencimientosService,
    );
    return servicio.copia(7);
  }

  it('arma cada local con sus productos, la carga de hoy y sus días con carga', async () => {
    const r = await copia();
    expect(r).toMatchObject({ usuarioId: 7, diasAviso: 5 });
    expect(r.productos).toEqual([{ itemcode: 'P0', itemname: 'P0' }]);
    expect(r.locales[0]).toMatchObject({
      id: 'C1',
      fechas: ['2026-10-20', '2026-10-18'],
      items: [
        { itemcode: 'A1', itemname: 'Agua', cantidad: 4, vencimiento: '2026-11-01' },
        { itemcode: 'B2', itemname: 'B2', cantidad: null, vencimiento: null },
      ],
    });
    expect(r.locales[1]).toMatchObject({ id: 'C2', fechas: [], items: [] });
  });

  it('nunca entrega una copia truncada', async () => {
    await expect(copia(50_001)).rejects.toBeInstanceOf(
      PayloadTooLargeException,
    );
  });
});
