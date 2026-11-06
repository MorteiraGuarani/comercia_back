import type { EstadoPedido, ItemPedido, LineaPedido, PedidoSap } from "@/types/pedido";

/** Pasos de productos del pedido; los mismos ids que valida la API. */
export const LINEAS_PEDIDO: { id: LineaPedido; nombre: string }[] = [
  { id: "hamburguesas", nombre: "Hamburguesas" },
  { id: "embutidos", nombre: "Embutidos" },
  { id: "pollo", nombre: "Pollo" },
  { id: "resto", nombre: "Resto" },
];

export const ESTADOS_PEDIDO: { id: EstadoPedido; nombre: string }[] = [
  { id: "CARGADO", nombre: "Cargado" },
  { id: "MIGRADO", nombre: "Migrado a SAP" },
  { id: "FACTURADO", nombre: "Facturado" },
  { id: "ENTREGADO", nombre: "Entregado" },
];

export function guaranies(valor: number): string {
  return `Gs. ${Math.round(valor).toLocaleString("es-PY")}`;
}

/**
 * Estructura del pedido para el Service Layer de SAP. Por ahora solo se muestra
 * en consola: sucursal, serie, número Comercia, parámetro de embarque y
 * almacén quedan vacíos hasta definirlos.
 */
export function armarPedidoSap(datos: {
  cardCode: string;
  hoy: string;
  entrega: string;
  observaciones: string;
  usuarioLogin: string;
  items: ItemPedido[];
}): PedidoSap {
  return {
    DocDate: `${datos.hoy}T00:00:00Z`,
    DocDueDate: `${datos.entrega}T00:00:00Z`,
    CardCode: datos.cardCode,
    NumAtCard: "",
    DocCurrency: "GS",
    DocRate: 1,
    Comments: datos.observaciones.trim(),
    JournalMemo: `Pedidos de cliente - ${datos.cardCode}`,
    Series: null,
    U_beas_pers_id: datos.usuarioLogin,
    U_beas_version: "",
    U_par: "",
    DocumentLines: datos.items.map((item, i) => ({
      LineNum: i,
      ItemCode: item.itemCode,
      Quantity: item.cantidad,
      WarehouseCode: "",
    })),
  };
}
