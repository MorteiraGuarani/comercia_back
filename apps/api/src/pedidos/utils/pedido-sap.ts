import { randomInt } from 'node:crypto';
import type {
  DatosPedidoSap,
  PedidoSap,
} from '../interfaces/pedido-sap.interface';

/** Canal de tbl_jcanales que sale de un solo almacén: el del usuario. */
const CANAL_ALMACEN_UNICO = '1';

const digitos = (n: number) =>
  `${randomInt(1, 10)}${Array.from({ length: n - 1 }, () => randomInt(10)).join('')}`;

// shortcut: aleatorio con el formato del ejemplo (10|12|14|10 dígitos) para que SAP lo acepte; reemplazar por el número real del pedido cuando se defina.
export const versionAleatoria = () => [10, 12, 14, 10].map(digitos).join('|');

/**
 * Pedidos para el Service Layer, uno por almacén. Canal 1: todo sale del
 * almacén del usuario (un pedido). Otro canal: cada producto sale de su DfltWH
 * si es un almacén de la sucursal y canal del usuario; si no, queda vacío.
 */
export function armarPedidosSap(d: DatosPedidoSap): PedidoSap[] {
  const [anio, mes, dia] = d.hoy.split('-');
  const almacenDe = (almacen: string | null) =>
    d.canal === CANAL_ALMACEN_UNICO
      ? (d.almacenUsuario ?? '')
      : almacen && d.almacenesCanal.includes(almacen)
        ? almacen
        : '';
  const porAlmacen = new Map<string, DatosPedidoSap['lineas']>();
  for (const l of d.lineas) {
    const codigo = almacenDe(l.almacen);
    porAlmacen.set(codigo, [...(porAlmacen.get(codigo) ?? []), l]);
  }
  return [...porAlmacen].map(([almacen, lineas]) => ({
    DocDate: `${d.hoy}T00:00:00Z`,
    DocDueDate: `${d.fechaEntrega}T00:00:00Z`,
    CardCode: d.cardCode,
    NumAtCard: '',
    DocCurrency: 'GS',
    DocRate: 1,
    Comments: `Migrado por Comercia el ${dia}/${mes}/${anio} ${d.hora}`,
    JournalMemo: `Pedidos de cliente - ${d.cardCode}`,
    Series: null,
    U_beas_pers_id: d.usuarioLogin,
    U_beas_version: versionAleatoria(),
    U_par: d.nombreAlmacenUsuario ?? '',
    DocumentLines: lineas.map((l, i) => ({
      LineNum: i,
      ItemCode: l.itemCode,
      Quantity: l.cantidad,
      WarehouseCode: almacen,
    })),
  }));
}
