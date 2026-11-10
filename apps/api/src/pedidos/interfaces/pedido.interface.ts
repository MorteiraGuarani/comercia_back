import type { LineaPedido } from '../utils/lineas-pedido';
import type { DocumentoSap } from './pedido-sap.interface';

export interface LineaPedidoRespuesta {
  itemCode: string;
  nombre: string;
  linea: LineaPedido;
  cantidad: number;
  precio: number | null;
  total: number | null;
}

/** Pedido armado desde otro, con productos y precios vigentes. */
export interface CopiaPedido {
  cliente: { id: string; nombre: string };
  items: {
    itemCode: string;
    nombre: string;
    linea: LineaPedido;
    cantidad: number;
    precio: number | null;
    almacen: string | null;
  }[];
  /** ItemCode que ya no se pueden pedir. */
  noDisponibles: string[];
}

export interface PedidoResumen {
  id: number;
  numero: string;
  cliente: { id: string; nombre: string };
  fechaEntrega: string;
  estado: 'CARGADO' | 'MIGRADO' | 'FACTURADO' | 'ENTREGADO';
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
  lineas: LineaPedidoRespuesta[];
  documentos: DocumentoSap[];
}
