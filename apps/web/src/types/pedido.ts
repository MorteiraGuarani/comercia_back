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
  /** Solo en el buscador: almacén del que saldría; null si no tiene. */
  almacen?: string | null;
}

/** Producto cargado en el pedido en curso. */
export interface ItemPedido extends ProductoPedido {
  linea: LineaPedido;
  cantidad: number;
}

/** Pedido armado desde otro, con productos y precios vigentes. */
export interface CopiaPedido {
  cliente: { id: string; nombre: string };
  items: ItemPedido[];
  /** ItemCode que ya no se pueden pedir. */
  noDisponibles: string[];
}

export interface PedidoResumen {
  id: number;
  numero: string;
  cliente: { id: string; nombre: string };
  fechaEntrega: string;
  estado: EstadoPedido;
  total: number;
  docNumSap: number | null;
  /** DocNum de cada documento que ya llegó a SAP. */
  docNums: number[];
  creadoEn: string;
  cantidadProductos: number;
  /** Solo guardado: nada de él llegó a SAP. */
  eliminable: boolean;
}

export interface PedidoDetalle extends PedidoResumen {
  observaciones: string;
  lineas: (ProductoPedido & {
    linea: LineaPedido;
    cantidad: number;
    total: number | null;
  })[];
  documentos: DocumentoSap[];
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

/** Orden de venta para el Service Layer de SAP B1 (POST /Orders); la arma la API. */
export interface PedidoSap {
  DocDate: string;
  DocDueDate: string;
  CardCode: string;
  /** AddressName2 del almacén. */
  NumAtCard: string;
  DocCurrency: string;
  DocRate: number;
  Comments: string;
  JournalMemo: string;
  /** Pendiente de definir. */
  Series: number | null;
  /** Usuario de Comercia. */
  U_beas_pers_id: string;
  /** «C|celular|AAAAMMDDHHMMSS|id de campo_documento». */
  U_beas_version: string;
  /** WarehouseName del almacén. */
  U_par: string;
  DocumentLines: {
    LineNum: number;
    ItemCode: string;
    Quantity: number;
    WarehouseCode: string;
  }[];
}

/** Documento guardado en campo_documento: el JSON para SAP y si ya se envió. */
export interface DocumentoSap {
  id: number;
  enviadoSap: boolean;
  /** Número que le asignó SAP. */
  docNum: number | null;
  /** Motivo por el que no llegó a SAP al enviarlo junto con el pedido. */
  errorSap?: string;
  sap: PedidoSap;
}
