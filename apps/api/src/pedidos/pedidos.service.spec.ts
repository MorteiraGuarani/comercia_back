import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../prisma/prisma.service';
import { PedidosService } from './pedidos.service';
import { aCreditoCliente } from './utils/credito-cliente';
import { lineaDeGrupo, whereLinea } from './utils/lineas-pedido';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('lineas de pedido', () => {
  it('ubica cada grupo de OITM en su línea y el resto fuera de las demás', () => {
    expect(lineaDeGrupo(144)).toBe('hamburguesas');
    expect(lineaDeGrupo(241)).toBe('pollo');
    expect(lineaDeGrupo(999)).toBe('resto');
    expect(lineaDeGrupo(null)).toBe('resto');
    expect(whereLinea('resto')).toEqual({
      OR: [{ itmsgrpcode: null }, { itmsgrpcode: { notIn: [144, 145, 241] } }],
    });
  });
});

describe('PedidosService.crear', () => {
  beforeEach(() =>
    jest.useFakeTimers().setSystemTime(new Date('2026-11-03T10:00:00-03:00')),
  );
  afterEach(() => jest.useRealTimers());

  function preparar(sapApiUrl?: string) {
    const prisma = {
      usuario: { findUnique: jest.fn().mockResolvedValue({ empresaId: 2 }) },
      socioNegocio: {
        findFirst: jest.fn().mockResolvedValue({
          CardCode: 'C0001',
          CardName: 'Despensa Don Tito',
          ListNum: 3,
          GroupNum: 5,
        }),
      },
      producto: {
        findMany: jest.fn().mockResolvedValue([
          { itemcode: 'H1', itemname: 'Hamburguesa clásica', itmsgrpcode: 144 },
          { itemcode: 'X9', itemname: 'Papas bastón', itmsgrpcode: 300 },
        ]),
      },
      productoPrecio: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ itemcode: 'H1', price: '3890.000000' }]),
      },
      pedido: {
        create: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue({
          id: 12,
          cardCode: 'C0001',
          clienteNombre: 'Despensa Don Tito',
          fechaEntrega: new Date('2026-11-04T00:00:00.000Z'),
          estado: 'CARGADO',
          total: '38900',
          docNumSap: null,
          createdAt: new Date('2026-11-03T13:00:00.000Z'),
          _count: { lineas: 2 },
        }),
      },
    };
    const servicio = new PedidosService(
      prisma as unknown as PrismaService,
      { get: () => sapApiUrl } as unknown as ConfigService,
    );
    const dto = {
      cardCode: 'C0001',
      fechaEntrega: '2026-11-04',
      lineas: [
        { itemCode: 'H1', cantidad: 10 },
        { itemCode: 'X9', cantidad: 2 },
      ],
    };
    return { prisma, servicio, dto };
  }

  it('toma el precio de la lista del cliente y guarda el pedido en CARGADO', async () => {
    const { prisma, servicio, dto } = preparar();
    const pedido = await servicio.crear(7, dto);
    expect(prisma.productoPrecio.findMany).toHaveBeenCalledWith({
      where: { empresaId: 2, pricelist: 3, itemcode: { in: ['H1', 'X9'] } },
      select: { itemcode: true, price: true },
    });
    expect(prisma.pedido.create.mock.calls[0][0]).toMatchObject({
      data: {
        empresaId: 2,
        usuarioId: 7,
        cardCode: 'C0001',
        listaPrecios: 3,
        condicionPago: 5,
        total: 38900,
        lineas: {
          create: [
            {
              itemCode: 'H1',
              linea: 'hamburguesas',
              precio: 3890,
              total: 38900,
            },
            { itemCode: 'X9', linea: 'resto', precio: null, total: null },
          ],
        },
      },
    });
    expect(pedido).toMatchObject({ numero: 'PV-12', total: 38900 });
  });

  it('no guarda el pedido de un cliente inhabilitado en SAP', async () => {
    const { prisma, servicio, dto } = preparar('http://sap.test');
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 201,
      text: () =>
        Promise.resolve(
          JSON.stringify([
            {
              Estado: 'INHABILITADO',
              MotivoInhabilitado:
                'Factura pendiente con 12 dias desde su vencimiento',
              CantidadFacturasPendientes: 1,
              MontoTotalPendiente: 'Gs. 90.000',
              FechaFacturaInhabilitante: '22/10/2026',
            },
          ]),
        ),
    } as unknown as Response);
    await expect(servicio.crear(7, dto)).rejects.toThrow(
      'El cliente está inhabilitado en SAP: Factura pendiente con 12 dias desde su vencimiento',
    );
    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://sap.test/execute/procedure',
    );
    expect(prisma.pedido.create).not.toHaveBeenCalled();
    fetchMock.mockRestore();
  });

  it('no guarda con entrega para hoy ni con productos que no están activos', async () => {
    const { prisma, servicio, dto } = preparar();
    await expect(
      servicio.crear(7, { ...dto, fechaEntrega: '2026-11-03' }),
    ).rejects.toThrow('La entrega tiene que ser desde mañana');
    prisma.producto.findMany.mockResolvedValue([
      { itemcode: 'H1', itemname: 'Hamburguesa clásica', itmsgrpcode: 144 },
    ]);
    await expect(servicio.crear(7, dto)).rejects.toThrow(
      'Productos no disponibles: X9',
    );
    expect(prisma.pedido.create).not.toHaveBeenCalled();
  });
});

describe('estado de crédito en SAP', () => {
  const fila = {
    CodigoCliente: 'C0001',
    Moneda: 'GS',
    CantidadFacturasPendientes: 2,
    MontoTotalPendiente: 'Gs. 150.000',
    Estado: 'HABILITADO' as const,
    MotivoInhabilitado: '',
    FechaFacturaInhabilitante: null,
  };

  it('une las monedas: una inhabilitada inhabilita al cliente', () => {
    expect(
      aCreditoCliente([
        fila,
        {
          ...fila,
          Moneda: 'USD',
          CantidadFacturasPendientes: 1,
          MontoTotalPendiente: 'USD 20,00',
          Estado: 'INHABILITADO',
          MotivoInhabilitado:
            'Factura pendiente con 15 dias desde su vencimiento',
          FechaFacturaInhabilitante: '18/10/2026',
        },
      ]),
    ).toEqual({
      habilitado: false,
      motivo: 'Factura pendiente con 15 dias desde su vencimiento',
      facturasPendientes: 3,
      montosPendientes: ['Gs. 150.000', 'USD 20,00'],
      fechaFacturaInhabilitante: '18/10/2026',
    });
  });
});
