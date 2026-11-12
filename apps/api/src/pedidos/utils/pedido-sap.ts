import type {
  DatosAlmacenUsuario,
  DatosPedidoSap,
  PedidoSap,
} from '../interfaces/pedido-sap.interface';

/** El último tramo de U_beas_version es el id de campo_documento: se conoce al guardarlo. */
export const conIdDocumento = (version: string, id: number) =>
  version.replace(/\d+$/, String(id));

/**
 * Clientes del vendedor: tbl_ocrd.SlpCode igual a su Código Vendedor
 * (ERP_CodUsuarioSap). Sin código, todos los de la empresa; un código no
 * numérico no coincide con ninguno.
 */
export const whereVendedor = (codigo: string | null) => {
  const texto = codigo?.trim();
  if (!texto) return {};
  const slp = Number(texto);
  return { SlpCode: Number.isInteger(slp) ? slp : -2 };
};

/**
 * Almacenes de tbl_owhs de la sucursal (Location) y canal (GlobalLocationNumber)
 * del usuario. Cuántos son decide el pedido, sin reglas por canal en el código:
 * uno es pedido unificado; varios, distribuido por el DefaultWarehouse de cada producto.
 */
export const almacenesDelUsuario = (d: DatosAlmacenUsuario) =>
  d.almacenes.filter(
    (a) =>
      !!d.canal &&
      d.sucursal !== null &&
      a.Location === d.sucursal &&
      a.GlobalLocationNumber === d.canal,
  );

/**
 * Almacén de un producto: el único de su sucursal y canal (unificado) o, si son
 * varios, el DefaultWarehouse del producto si es uno de ellos (distribuido). Si no, vacío.
 */
export function resolverAlmacen(d: DatosAlmacenUsuario) {
  const suyos = almacenesDelUsuario(d);
  const codigos = new Set(suyos.map((a) => a.WarehouseCode));
  return (codigo: string | null) =>
    suyos.length === 1
      ? suyos[0].WarehouseCode
      : codigo && codigos.has(codigo)
        ? codigo
        : '';
}

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
