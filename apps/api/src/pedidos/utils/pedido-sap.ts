import type {
  DatosPedidoSap,
  PedidoSap,
} from '../interfaces/pedido-sap.interface';

/** Canal de tbl_jcanales que sale de un solo almacén: el del usuario. */
const CANAL_ALMACEN_UNICO = '1';

/** El último tramo de U_beas_version es el id de campo_documento: se conoce al guardarlo. */
export const conIdDocumento = (version: string, id: number) =>
  version.replace(/\d+$/, String(id));

/**
 * Pedidos para el Service Layer, uno por almacén. Canal 1: todo sale del
 * almacén del usuario (un pedido). Otro canal: cada producto sale de su DfltWH
 * si es un almacén de la sucursal y canal del usuario; si no, queda vacío.
 */
export function armarPedidosSap(d: DatosPedidoSap): PedidoSap[] {
  const [anio, mes, dia] = d.hoy.split('-');
  const porCodigo = new Map(d.almacenes.map((a) => [a.WarehouseCode, a]));
  const almacenDe = (codigo: string | null) => {
    if (d.canal === CANAL_ALMACEN_UNICO) return d.almacenUsuario ?? '';
    const a = codigo ? porCodigo.get(codigo) : undefined;
    return a &&
      d.canal &&
      d.sucursal !== null &&
      a.Location === d.sucursal &&
      a.GlobalLocationNumber === d.canal
      ? a.WarehouseCode
      : '';
  };
  const porAlmacen = new Map<string, DatosPedidoSap['lineas']>();
  for (const l of d.lineas) {
    const codigo = almacenDe(l.almacen);
    porAlmacen.set(codigo, [...(porAlmacen.get(codigo) ?? []), l]);
  }
  return [...porAlmacen].map(([almacen, lineas]) => ({
    DocDate: `${d.hoy}T00:00:00Z`,
    DocDueDate: `${d.fechaEntrega}T00:00:00Z`,
    CardCode: d.cardCode,
    NumAtCard: porCodigo.get(almacen)?.AddressName2 ?? '',
    DocCurrency: 'GS',
    DocRate: 1,
    Comments: `Migrado por Comercia el ${dia}/${mes}/${anio} ${d.hora}`,
    JournalMemo: `Pedidos de cliente - ${d.cardCode}`,
    Series: null,
    U_beas_pers_id: d.usuarioLogin,
    U_beas_version: `C|${d.celular.replace(/\D/g, '')}|${d.sello}|0`,
    U_par: porCodigo.get(almacen)?.WarehouseName ?? '',
    DocumentLines: lineas.map((l, i) => ({
      LineNum: i,
      ItemCode: l.itemCode,
      Quantity: l.cantidad,
      WarehouseCode: almacen,
    })),
  }));
}
