import type { Prisma } from '../../../generated/prisma/client';
import type {
  AlmacenSap,
  DatosAlmacenUsuario,
  DatosPedidoSap,
  PedidoSap,
} from '../interfaces/pedido-sap.interface';

/** Canal de tbl_jcanales que sale de un solo almacén: el de la sucursal del usuario. */
export const CANAL_ALMACEN_UNICO = '1';

/** El último tramo de U_beas_version es el id de campo_documento: se conoce al guardarlo. */
export const conIdDocumento = (version: string, id: number) =>
  version.replace(/\d+$/, String(id));

/**
 * Almacén de un producto. Canal 1: el único almacén de tbl_owhs de la sucursal
 * y canal del usuario, para todos los productos. Otro canal: el DfltWH del
 * producto si es de la sucursal y canal del usuario. Si no, vacío.
 */
export function resolverAlmacen(d: DatosAlmacenUsuario) {
  const porCodigo = new Map(d.almacenes.map((a) => [a.WarehouseCode, a]));
  const deSucursal = (a: AlmacenSap) =>
    !!d.canal &&
    d.sucursal !== null &&
    a.Location === d.sucursal &&
    a.GlobalLocationNumber === d.canal;
  // Con cero o varios no se elige ninguno: elegir uno podría descontar del depósito equivocado.
  const delCanal = d.almacenes.filter(deSucursal);
  const almacenCanal = delCanal.length === 1 ? delCanal[0].WarehouseCode : '';
  return (codigo: string | null) => {
    if (d.canal === CANAL_ALMACEN_UNICO) return almacenCanal;
    const a = codigo ? porCodigo.get(codigo) : undefined;
    return a && deSucursal(a) ? a.WarehouseCode : '';
  };
}

/**
 * Productos que el usuario puede pedir. Canal 1: todos, salen del almacén de su
 * sucursal (si falta, el aviso "Sin almacén" lo hace visible). Otro canal: solo
 * los que tienen DfltWH en un almacén de su sucursal y canal.
 */
export const whereConAlmacen = (
  canal: string | null,
  almacenes: AlmacenSap[],
): Prisma.ProductoWhereInput =>
  canal === CANAL_ALMACEN_UNICO
    ? {}
    : { almacen: { in: almacenes.map((a) => a.WarehouseCode) } };

/** Pedidos para el Service Layer, uno por almacén. */
export function armarPedidosSap(d: DatosPedidoSap): PedidoSap[] {
  const [anio, mes, dia] = d.hoy.split('-');
  const porCodigo = new Map(d.almacenes.map((a) => [a.WarehouseCode, a]));
  const almacenDe = resolverAlmacen(d);
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
    Comments: [
      `Migrado por Comercia el ${dia}/${mes}/${anio} ${d.hora}`,
      d.observaciones,
    ]
      .filter(Boolean)
      .join('\n'),
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
