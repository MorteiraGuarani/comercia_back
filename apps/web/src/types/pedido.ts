export type LineaPedido = "hamburguesas" | "embutidos" | "pollo" | "resto";
export type EstadoPedido = "CARGADO" | "MIGRADO" | "FACTURADO" | "ENTREGADO";

/** Estado de crédito del cliente en SAP (SP_ESTADO_CREDITO_CLIENTES). */
export interface CreditoCliente {
  habilitado: boolean;
  motivo: string;
  facturasPendientes: number;
  montosPendientes: string[];
  fechaFacturaInhabilitante: string | null;
}

/** Perfil del cliente de tbl_ocrd (paso 1 del pedido). */
export interface PerfilClientePedido {
  id: string;
  nombre: string;
  direccion: string;
  alias: string;
  ruc: string;
  telefono: string;
  canal: string | null;
  condicionPago: string | null;
  listaPrecios: string | null;
  diasVisita: string[];
  /** null si no se pudo consultar SAP. */
  credito: CreditoCliente | null;
}

export interface ProductoPedido {
  itemCode: string;
  nombre: string;
  /** Precio de la lista del cliente; null si no tiene. */
  precio: number | null;
}

/** Producto cargado en el pedido en curso. */
export interface ItemPedido extends ProductoPedido {
  linea: LineaPedido;
  cantidad: number;
}

export interface PedidoResumen {
  id: number;
  numero: string;
  cliente: { id: string; nombre: string };
  fechaEntrega: string;
  estado: EstadoPedido;
  total: number;
  docNumSap: number | null;
  creadoEn: string;
  cantidadProductos: number;
}

export interface PedidoDetalle extends PedidoResumen {
  observaciones: string;
  lineas: (ProductoPedido & {
    linea: LineaPedido;
    cantidad: number;
    total: number | null;
  })[];
}

/** Factura del cliente en SAP (SP_ULTIMAS_4_FACTURAS_CLIENTE). */
export interface FacturaCliente {
  docEntry: number;
  docNum: number;
  fecha: string;
  /** Ya formateado por SAP ("GS 191.780"). */
  montoTotal: string;
}

/** Línea de una factura del cliente (SP_DETALLE_FACTURA_CLIENTE). */
export interface LineaFacturaCliente {
  itemCode: string;
  nombre: string;
  cantidad: number;
  precioUnitario: string;
  precioTotal: string;
}

/** Orden de venta para el Service Layer de SAP B1 (POST /Orders). */
export interface PedidoSap {
  DocDate: string;
  DocDueDate: string;
  CardCode: string;
  /** Sucursal del usuario (tbl_oclp). */
  NumAtCard: string;
  DocCurrency: string;
  DocRate: number;
  Comments: string;
  JournalMemo: string;
  /** Serie de pedidos de la sucursal. */
  Series: number | null;
  /** Usuario de Comercia. */
  U_beas_pers_id: string;
  /** Número del pedido en Comercia: 4 números separados por «|». */
  U_beas_version: string;
  /** Parámetro de embarque. */
  U_par: string;
  DocumentLines: {
    LineNum: number;
    ItemCode: string;
    Quantity: number;
    WarehouseCode: string;
  }[];
}
