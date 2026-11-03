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
