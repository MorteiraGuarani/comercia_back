import type {
  AlmacenSap,
  DatosPedidoSap,
} from '../interfaces/pedido-sap.interface';
import { armarPedidosSap, conIdDocumento } from './pedido-sap';

const almacen = (
  WarehouseCode: string,
  GlobalLocationNumber: string,
  AddressName2: string,
): AlmacenSap => ({
  WarehouseCode,
  WarehouseName: `Depósito ${WarehouseCode}`,
  AddressName2,
  Location: 3,
  GlobalLocationNumber,
});

const base: DatosPedidoSap = {
  cardCode: 'C001',
  hoy: '2026-11-30',
  fechaEntrega: '2026-12-05',
  hora: '10:47',
  observaciones: '',
  sello: '20261130104755',
  usuarioLogin: 'vendedor',
  celular: '+595991188620',
  canal: '1',
  sucursal: 3,
  almacenes: [
    almacen('ITG-PRV', '1', 'PV-ITAUGUA'),
    almacen('ITG-EMB', '2', 'ITAUGUA'),
    almacen('ITG-HAM', '2', 'ITAUGUA'),
  ],
  lineas: [
    { itemCode: 'H1', cantidad: 2, almacen: 'ITG-HAM' },
    { itemCode: 'E1', cantidad: 1, almacen: 'ITG-EMB' },
    { itemCode: 'H2', cantidad: 3, almacen: 'ITG-HAM' },
    { itemCode: 'X1', cantidad: 1, almacen: '01' },
  ],
};

describe('armarPedidosSap', () => {
  it('cualquier canal con un solo almacén en su sucursal es pedido unificado', () => {
    const pedidos = armarPedidosSap({
      ...base,
      canal: '3',
      almacenes: [
        almacen('CDE-VEN', '3', 'PV-CDE'),
        { ...almacen('CDE-OTR', '3', 'OTRA'), Location: 4 },
      ],
    });
    expect(pedidos).toHaveLength(1);
    expect(pedidos[0]).toMatchObject({
      NumAtCard: 'PV-CDE',
      U_par: 'Depósito CDE-VEN',
    });
    expect(pedidos[0].DocumentLines.map((l) => l.WarehouseCode)).toEqual([
      'CDE-VEN',
      'CDE-VEN',
      'CDE-VEN',
      'CDE-VEN',
    ]);
  });

  it('sin almacenes de su sucursal y canal, o con varios y sin DfltWH de ellos, no hay almacén', () => {
    const almacenesDe = (lista: AlmacenSap[]) =>
      armarPedidosSap({ ...base, almacenes: lista }).map(
        (p) => p.DocumentLines[0].WarehouseCode,
      );
    expect(
      almacenesDe([{ ...almacen('ITG-PV2', '1', 'PV'), Location: 4 }]),
    ).toEqual(['']);
    // Varios de canal 1: pasa a distribuido y los DfltWH de las líneas no son de ellos.
    expect(
      almacenesDe([almacen('ITG-PRV', '1', 'A'), almacen('ITG-PR2', '1', 'B')]),
    ).toEqual(['']);
  });

  it('unificado: un solo pedido desde el almacén de su sucursal y canal', () => {
    const pedidos = armarPedidosSap(base);
    expect(pedidos).toHaveLength(1);
    expect(pedidos[0]).toMatchObject({
      DocDate: '2026-11-30T00:00:00Z',
      DocDueDate: '2026-12-05T00:00:00Z',
      Comments: 'Migrado por Comercia el 30/11/2026 10:47',
      NumAtCard: 'PV-ITAUGUA',
      U_par: 'Depósito ITG-PRV',
      Series: null,
      U_beas_version: 'C|595991188620|20261130104755|0',
    });
    expect(
      new Set(pedidos[0].DocumentLines.map((l) => l.WarehouseCode)),
    ).toEqual(new Set(['ITG-PRV']));
  });

  it('distribuido: un pedido por DfltWH del producto, sin almacén si no es de su sucursal y canal', () => {
    const pedidos = armarPedidosSap({ ...base, canal: '2' });
    expect(
      pedidos.map((p) => [
        p.DocumentLines[0].WarehouseCode,
        p.NumAtCard,
        p.U_par,
        p.DocumentLines.map((l) => `${l.LineNum}:${l.ItemCode}`),
      ]),
    ).toEqual([
      ['ITG-HAM', 'ITAUGUA', 'Depósito ITG-HAM', ['0:H1', '1:H2']],
      ['ITG-EMB', 'ITAUGUA', 'Depósito ITG-EMB', ['0:E1']],
      ['', '', '', ['0:X1']],
    ]);
  });

  it('sin canal ni sucursal no asigna almacenes sin datos', () => {
    const pedidos = armarPedidosSap({
      ...base,
      canal: null,
      sucursal: null,
      almacenes: [
        {
          ...almacen('1', '', ''),
          Location: null,
          GlobalLocationNumber: null,
        },
      ],
      lineas: [{ itemCode: 'H1', cantidad: 1, almacen: '1' }],
    });
    expect(pedidos[0].DocumentLines[0].WarehouseCode).toBe('');
  });

  it('el comentario del usuario va en otra línea, después del migrado', () => {
    const [pedido] = armarPedidosSap({
      ...base,
      observaciones: 'Portón lateral',
    });
    expect(pedido.Comments).toBe(
      'Migrado por Comercia el 30/11/2026 10:47\nPortón lateral',
    );
  });

  it('pone el id del documento en el último tramo', () => {
    expect(conIdDocumento('C|595991188620|20261130104755|0', 41)).toBe(
      'C|595991188620|20261130104755|41',
    );
  });
});
