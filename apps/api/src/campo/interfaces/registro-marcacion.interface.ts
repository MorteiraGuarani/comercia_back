import type { Prisma } from '../../../generated/prisma/client';

export type ResultadoRegistroMarcacion = 'ACEPTADA' | 'RECHAZADA' | 'ERROR';

/** Lo que el interceptor lee del pedido (Express + el usuario de la sesión). */
export interface PedidoMarcacion {
  method: string;
  originalUrl?: string;
  route?: { path?: string };
  params?: unknown;
  query?: unknown;
  body?: unknown;
  usuarioId?: number;
}

/** Cómo terminó el pedido. */
export interface FinPedido {
  resultado: ResultadoRegistroMarcacion;
  estadoHttp: number;
  codigo?: string;
  motivo: string;
  respuesta: Prisma.InputJsonValue;
}
