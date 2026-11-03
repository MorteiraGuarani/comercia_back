import type { LineaPedido } from '../utils/lineas-pedido';

export interface LineaPedidoRespuesta {
  itemCode: string;
  nombre: string;
  linea: LineaPedido;
  cantidad: number;
  precio: number | null;
  total: number | null;
}

export interface PedidoResumen {
  id: number;
  numero: string;
  cliente: { id: string; nombre: string };
  fechaEntrega: string;
  estado: 'CARGADO' | 'MIGRADO' | 'FACTURADO' | 'ENTREGADO';
  total: number;
  docNumSap: number | null;
  creadoEn: string;
  cantidadProductos: number;
}

export interface PedidoDetalle extends PedidoResumen {
  observaciones: string;
  lineas: LineaPedidoRespuesta[];
}
