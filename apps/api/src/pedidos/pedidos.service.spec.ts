import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../prisma/prisma.service';
import { PedidosService } from './pedidos.service';
import type { ServiceLayerService } from './service-layer.service';
import { aCreditoCliente } from './utils/credito-cliente';
import { lineaDeGrupo, whereLinea } from './utils/lineas-pedido';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

const sinServiceLayer = {
  crearOrden: jest.fn(),
} as unknown as ServiceLayerService;

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
    const tx = {
      usuario: {
        findUnique: jest.fn().mockResolvedValue({
          empresaId: 2,
          nombreLogin: 'vendedor',
          celular: '+595991188620',
          ERP_Sucursal: 3,
          ERP_CanalVenta: '2',
          ERP_CodigoAlmacen: null,
        }),
      },
      almacen: {
        findMany: jest.fn().mockResolvedValue([
          {
            WarehouseCode: 'ITG-HAM',
            WarehouseName: 'Hamburguesas',
            AddressName2: 'ITAUGUA',
            Location: 3,
            GlobalLocationNumber: '2',
          },
        ]),
      },
      campoDocumento: {
        create: jest.fn().mockResolvedValue({ id: 41 }),
        update: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue({}),
      },
      socioNegocio: {
        findFirst: jest.fn().mockResolvedValue({
          CardCode: 'C0001',
          CardName: 'Despensa Don Tito',
          ListNum: 3,
          GroupNum: 5,
        }),
      },
      producto: {
        count: jest.fn().mockResolvedValue(2),
        findMany: jest.fn().mockResolvedValue([
          {
            itemcode: 'H1',
            itemname: 'Hamburguesa clásica',
            itmsgrpcode: 144,
            almacen: 'ITG-HAM',
          },
          {
            itemcode: 'X9',
            itemname: 'Papas bastón',
            itmsgrpcode: 300,
            almacen: 'ITG-HAM',
          },
        ]),
      },
      productoPrecio: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ itemcode: 'H1', price: '3890.000000' }]),
      },
      pedido: {
        findFirst: jest.fn().mockResolvedValue(null),
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
          documentos: [],
        }),
      },
    };
    const prisma = {
      ...tx,
      $transaction: (f: (cliente: typeof tx) => unknown) => f(tx),
    };
    const servicio = new PedidosService(
      prisma as unknown as PrismaService,
      { get: () => sapApiUrl } as unknown as ConfigService,
      sinServiceLayer,
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

  it('el buscador dice de qué almacén sale cada producto', async () => {
    const { prisma, servicio } = preparar();
    prisma.producto.findMany.mockResolvedValue([
      { itemcode: 'H1', itemname: 'Hamburguesa', almacen: 'ITG-HAM' },
      { itemcode: 'PV14', itemname: 'Besito', almacen: null },
    ]);
    const { items } = await servicio.productos(7, {
      cardCode: 'C0001',
      linea: 'embutidos',
    });
    expect(items.map((p) => p.almacen)).toEqual(['ITG-HAM', null]);
  });

  it('guarda el documento de SAP con su id en U_beas_version', async () => {
    const { prisma, servicio, dto } = preparar();
    const { documentos } = await servicio.crear(7, dto);
    expect(prisma.campoDocumento.create).toHaveBeenCalledTimes(1);
    expect(prisma.campoDocumento.update.mock.calls[0][0]).toEqual({
      where: { id: 41 },
      data: { U_beas_version: 'C|595991188620|20261103100000|41' },
    });
    expect(documentos).toEqual([
      expect.objectContaining({
        id: 41,
        enviadoSap: false,
        sap: expect.objectContaining({
          NumAtCard: 'ITAUGUA',
          U_par: 'Hamburguesas',
          Series: null,
          U_beas_version: 'C|595991188620|20261103100000|41',
        }) as unknown,
      }),
    ]);
  });

  it('una sincronización repetida devuelve el pedido ya guardado', async () => {
    const { prisma, servicio, dto } = preparar();
    prisma.pedido.findFirst.mockResolvedValue({
      id: 12,
      cardCode: 'C0001',
      clienteNombre: 'Despensa Don Tito',
      fechaEntrega: new Date('2026-11-04T00:00:00.000Z'),
      estado: 'CARGADO',
      total: '38900',
      docNumSap: null,
      createdAt: new Date('2026-11-03T13:00:00.000Z'),
      _count: { lineas: 0 },
      observaciones: '',
      lineas: [],
      documentos: [],
    });
    const operacionId = '6f1c1c4e-0d6b-4a3e-9a55-111111111111';
    const pedido = await servicio.crear(7, { ...dto, operacionId });
    expect(prisma.pedido.findFirst.mock.calls[0]).toMatchObject([
      { where: { usuarioId: 7, operacionId } },
    ]);
    expect(pedido.numero).toBe('PV-12');
    expect(prisma.pedido.create).not.toHaveBeenCalled();
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

describe('PedidosService.enviarDocumento', () => {
  function preparar(cambios: object = {}) {
    const fila = {
      id: 41,
      enviadoSap: false,
      DocNum: null,
      empresaId: 2,
      pedidoId: 12,
      DocDate: new Date('2026-11-03T00:00:00.000Z'),
      DocDueDate: new Date('2026-11-05T00:00:00.000Z'),
      DocRate: '1',
      CardCode: 'C1',
      lineas: [
        { LineNum: 0, ItemCode: 'H1', Quantity: 1, WarehouseCode: 'ITG-HAM' },
      ],
      ...cambios,
    };
    const tx = {
      campoDocumento: {
        findFirst: jest.fn().mockResolvedValue(fila),
        update: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(0),
      },
      empresa: {
        findUnique: jest.fn().mockResolvedValue({
          sapEsquema: 'FG_DESARROLLO',
          sapUsuario: 'comercia',
          sapContrasenia: 'clave',
        }),
      },
      pedido: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue({}),
      },
      pedidoLinea: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ itemCode: 'H1', nombre: 'Hamburguesa' }]),
      },
    };
    const prisma = {
      ...tx,
      $transaction: (f: (cliente: typeof tx) => unknown) => f(tx),
    };
    const crearOrden = jest
      .fn<Promise<unknown>, [unknown, Record<string, unknown>]>()
      .mockResolvedValue({ DocEntry: 9, DocNum: 700 });
    const servicio = new PedidosService(
      prisma as unknown as PrismaService,
      { get: () => undefined } as unknown as ConfigService,
      { crearOrden } as unknown as ServiceLayerService,
    );
    return { tx, crearOrden, servicio };
  }

  it('usa los datos de la empresa y lo marca enviado con su número', async () => {
    const { tx, crearOrden, servicio } = preparar();
    await expect(servicio.enviarDocumento(7, 41)).resolves.toMatchObject({
      enviadoSap: true,
      docNum: 700,
    });
    expect(tx.campoDocumento.findFirst.mock.calls[0]).toMatchObject([
      { where: { id: 41, usuarioId: 7 } },
    ]);
    expect(crearOrden.mock.calls[0][0]).toEqual({
      esquema: 'FG_DESARROLLO',
      usuario: 'comercia',
      contrasenia: 'clave',
    });
    expect(crearOrden.mock.calls[0][1]).not.toHaveProperty('DocNum');
    expect(crearOrden.mock.calls[0][1]).not.toHaveProperty('pedidoId');
    expect(tx.campoDocumento.update.mock.calls[0][0]).toEqual({
      where: { id: 41 },
      data: { enviadoSap: true, DocNum: 700 },
    });
    expect(tx.pedido.update.mock.calls[0][0]).toEqual({
      where: { id: 12 },
      data: { estado: 'MIGRADO' },
    });
  });

  it('si SAP falla sigue sin enviar', async () => {
    const { tx, crearOrden, servicio } = preparar();
    crearOrden.mockRejectedValue(new Error('SAP: Invalid item'));
    await expect(servicio.enviarDocumento(7, 41)).rejects.toThrow(
      'SAP: Invalid item',
    );
    expect(tx.campoDocumento.update).not.toHaveBeenCalled();
  });

  it('no reenvía uno enviado ni manda líneas sin almacén', async () => {
    const enviado = preparar({ enviadoSap: true, DocNum: 700 });
    await expect(
      enviado.servicio.enviarDocumento(7, 41),
    ).resolves.toMatchObject({ docNum: 700 });
    expect(enviado.crearOrden).not.toHaveBeenCalled();
    const sinAlmacen = preparar({
      lineas: [{ LineNum: 0, ItemCode: 'H1', Quantity: 1, WarehouseCode: '' }],
    });
    await expect(sinAlmacen.servicio.enviarDocumento(7, 41)).rejects.toThrow(
      'Productos sin almacén: H1 (Hamburguesa)',
    );
    expect(sinAlmacen.crearOrden).not.toHaveBeenCalled();
  });
});

describe('PedidosService.eliminar', () => {
  function preparar(borrados: number, existentes: number) {
    const pedido = {
      deleteMany: jest
        .fn<Promise<unknown>, [unknown]>()
        .mockResolvedValue({ count: borrados }),
      count: jest.fn().mockResolvedValue(existentes),
    };
    const servicio = new PedidosService(
      { pedido } as unknown as PrismaService,
      { get: () => undefined } as unknown as ConfigService,
      sinServiceLayer,
    );
    return { pedido, servicio };
  }

  it('borra solo si es propio y no llegó a SAP', async () => {
    const { pedido, servicio } = preparar(1, 1);
    await servicio.eliminar(7, 12);
    expect(pedido.deleteMany.mock.calls[0][0]).toEqual({
      where: {
        id: 12,
        usuarioId: 7,
        estado: 'CARGADO',
        docNumSap: null,
        documentos: { none: { enviadoSap: true } },
      },
    });
  });

  it('rechaza el enviado y no revela el ajeno', async () => {
    await expect(preparar(0, 1).servicio.eliminar(7, 12)).rejects.toThrow(
      'Un pedido enviado a SAP no se puede eliminar',
    );
    await expect(preparar(0, 0).servicio.eliminar(7, 12)).rejects.toThrow(
      'Pedido no encontrado',
    );
  });
});

describe('PedidosService.editarDocumento', () => {
  beforeEach(() =>
    jest.useFakeTimers().setSystemTime(new Date('2026-11-03T10:00:00-03:00')),
  );
  afterEach(() => jest.useRealTimers());

  function preparar(enviadoSap = false) {
    const tx = {
      campoDocumento: {
        findFirst: jest.fn().mockResolvedValue({
          pedidoId: 12,
          enviadoSap,
          Comments: 'Migrado por Comercia el 03/11/2026 10:00\nViejo',
          lineas: [
            { ItemCode: 'H1', WarehouseCode: 'ITG-HAM' },
            { ItemCode: 'H2', WarehouseCode: 'ITG-HAM' },
          ],
        }),
        update: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue({
          id: 41,
          enviadoSap: false,
          DocDate: new Date('2026-11-03T00:00:00.000Z'),
          DocDueDate: new Date('2026-11-05T00:00:00.000Z'),
          DocRate: '1',
          lineas: [],
        }),
      },
      campoDocumentoLinea: { deleteMany: jest.fn().mockResolvedValue({}) },
      pedidoLinea: {
        deleteMany: jest
          .fn<Promise<unknown>, [unknown]>()
          .mockResolvedValue({}),
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 5, itemCode: 'H1', precio: '100' }]),
        update: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue({}),
        aggregate: jest.fn().mockResolvedValue({ _sum: { total: 300 } }),
      },
      pedido: {
        update: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue({}),
      },
    };
    const prisma = {
      ...tx,
      $transaction: (f: (cliente: typeof tx) => unknown) => f(tx),
    };
    const servicio = new PedidosService(
      prisma as unknown as PrismaService,
      { get: () => undefined } as unknown as ConfigService,
      sinServiceLayer,
    );
    return { tx, servicio };
  }

  const dto = {
    DocDueDate: '2026-11-05',
    Comments: ' Cambio ',
    lineas: [{ ItemCode: 'H1', Quantity: 3 }],
  };

  it('quita lo que no viene, renumera y mantiene el total del pedido', async () => {
    const { tx, servicio } = preparar();
    await servicio.editarDocumento(7, 41, dto);
    expect(tx.campoDocumento.findFirst.mock.calls[0]).toMatchObject([
      { where: { id: 41, usuarioId: 7 } },
    ]);
    expect(tx.campoDocumento.update.mock.calls[0][0]).toMatchObject({
      data: {
        Comments: 'Migrado por Comercia el 03/11/2026 10:00\nCambio',
        lineas: {
          create: [
            {
              LineNum: 0,
              ItemCode: 'H1',
              Quantity: 3,
              WarehouseCode: 'ITG-HAM',
            },
          ],
        },
      },
    });
    expect(tx.pedidoLinea.deleteMany.mock.calls[0][0]).toEqual({
      where: { pedidoId: 12, itemCode: { in: ['H2'] } },
    });
    expect(tx.pedidoLinea.update.mock.calls[0][0]).toEqual({
      where: { id: 5 },
      data: { cantidad: 3, total: 300 },
    });
    expect(tx.pedido.update.mock.calls[0][0]).toEqual({
      where: { id: 12 },
      data: { total: 300 },
    });
  });

  it('no edita uno ya enviado ni agrega productos ajenos', async () => {
    await expect(
      preparar(true).servicio.editarDocumento(7, 41, dto),
    ).rejects.toThrow('El documento ya se envió a SAP');
    await expect(
      preparar().servicio.editarDocumento(7, 41, {
        ...dto,
        lineas: [{ ItemCode: 'Z9', Quantity: 1 }],
      }),
    ).rejects.toThrow('Los productos no corresponden a este documento');
  });
});

describe('PedidosService facturas de SAP', () => {
  const factura = {
    DocEntry: 501,
    DocNum: 18311,
    Fecha: '02/10/2026',
    MontoTotal: 'GS 191.780',
  };
  const linea = {
    'ID Articulo': 'H1',
    'Nombre Articulo': 'Hamburguesa clásica ',
    'Precio Unitario': 'GS 3.890',
    Cantidad: 12,
    'Precio Total': 'GS 46.680',
    Almacen: '01',
  };
  const sap = (filas: unknown) =>
    ({
      ok: true,
      status: 201,
      text: () => Promise.resolve(JSON.stringify(filas)),
    }) as unknown as Response;

  function preparar() {
    const prisma = {
      usuario: { findUnique: jest.fn().mockResolvedValue({ empresaId: 2 }) },
      socioNegocio: {
        findFirst: jest.fn().mockResolvedValue({ CardCode: 'C0001' }),
      },
    };
    const servicio = new PedidosService(
      prisma as unknown as PrismaService,
      { get: () => 'http://sap.test' } as unknown as ConfigService,
      sinServiceLayer,
    );
    return { prisma, servicio };
  }
  afterEach(() => jest.restoreAllMocks());
  const cuerpo = (llamada: Parameters<typeof fetch>) =>
    JSON.parse(llamada[1]?.body as string) as unknown;

  it('devuelve las facturas del cliente de la empresa con DTO mínimo', async () => {
    const { prisma, servicio } = preparar();
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(sap([factura]));
    await expect(servicio.facturas(7, 'C0001')).resolves.toEqual([
      {
        docEntry: 501,
        docNum: 18311,
        fecha: '02/10/2026',
        montoTotal: 'GS 191.780',
      },
    ]);
    expect(prisma.socioNegocio.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- matcher de jest
        where: expect.objectContaining({ empresaId: 2, CardCode: 'C0001' }),
      }),
    );
    expect(cuerpo(fetchMock.mock.calls[0])).toMatchObject({
      procedureName: 'SP_ULTIMAS_4_FACTURAS_CLIENTE',
      params: ['C0001'],
    });
  });

  it('no consulta SAP para un cliente fuera de la empresa', async () => {
    const { prisma, servicio } = preparar();
    prisma.socioNegocio.findFirst.mockResolvedValue(null);
    const fetchMock = jest.spyOn(global, 'fetch');
    await expect(servicio.facturas(7, 'OTRO')).rejects.toThrow(
      'Cliente no disponible',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('da el detalle solo de una factura del cliente', async () => {
    const { servicio } = preparar();
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(sap([factura]))
      .mockResolvedValueOnce(sap([linea]))
      .mockResolvedValueOnce(sap([factura]));
    await expect(servicio.detalleFactura(7, 'C0001', 501)).resolves.toEqual([
      {
        itemCode: 'H1',
        nombre: 'Hamburguesa clásica',
        cantidad: 12,
        precioUnitario: 'GS 3.890',
        precioTotal: 'GS 46.680',
      },
    ]);
    expect(cuerpo(fetchMock.mock.calls[1])).toMatchObject({
      procedureName: 'SP_DETALLE_FACTURA_CLIENTE',
      params: [501],
    });
    await expect(servicio.detalleFactura(7, 'C0001', 999)).rejects.toThrow(
      'Factura no disponible',
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('responde 503 si SAP no contesta', async () => {
    const { servicio } = preparar();
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    await expect(servicio.facturas(7, 'C0001')).rejects.toThrow(
      'No se pudieron consultar las facturas en SAP',
    );
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
