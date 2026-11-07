import type { DatosPedidoSap } from '../interfaces/pedido-sap.interface';
import { armarPedidosSap } from './pedido-sap';

const base: DatosPedidoSap = {
  cardCode: 'C001',
  hoy: '2026-11-30',
  fechaEntrega: '2026-12-05',
  hora: '10:47',
  usuarioLogin: 'vendedor',
  canal: '1',
  almacenUsuario: 'ITG-PRV',
  nombreAlmacenUsuario: 'Deposito Preventa Itaugua',
  almacenesCanal: ['ITG-EMB', 'ITG-HAM'],
  lineas: [
    { itemCode: 'H1', cantidad: 2, almacen: 'ITG-HAM' },
    { itemCode: 'E1', cantidad: 1, almacen: 'ITG-EMB' },
    { itemCode: 'H2', cantidad: 3, almacen: 'ITG-HAM' },
    { itemCode: 'X1', cantidad: 1, almacen: '01' },
  ],
};

describe('armarPedidosSap', () => {
  it('canal 1: un solo pedido desde el almacén del usuario', () => {
    const pedidos = armarPedidosSap(base);
    expect(pedidos).toHaveLength(1);
    expect(pedidos[0]).toMatchObject({
      DocDate: '2026-11-30T00:00:00Z',
      DocDueDate: '2026-12-05T00:00:00Z',
      Comments: 'Migrado por Comercia el 30/11/2026 10:47',
    });
    expect(pedidos[0].U_beas_version).toMatch(
      /^[1-9]\d{9}\|[1-9]\d{11}\|[1-9]\d{13}\|[1-9]\d{9}$/,
    );
    expect(pedidos[0].U_par).toBe('Deposito Preventa Itaugua');
    expect(pedidos[0].DocumentLines.map((l) => l.WarehouseCode)).toEqual([
      'ITG-PRV',
      'ITG-PRV',
      'ITG-PRV',
      'ITG-PRV',
    ]);
  });

  it('canal 2: un pedido por almacén del producto, sin almacén si no es de su sucursal', () => {
    const pedidos = armarPedidosSap({ ...base, canal: '2' });
    expect(
      pedidos.map((p) => [
        p.DocumentLines[0].WarehouseCode,
        p.DocumentLines.map((l) => `${l.LineNum}:${l.ItemCode}`),
      ]),
    ).toEqual([
      ['ITG-HAM', ['0:H1', '1:H2']],
      ['ITG-EMB', ['0:E1']],
      ['', ['0:X1']],
    ]);
  });
});
