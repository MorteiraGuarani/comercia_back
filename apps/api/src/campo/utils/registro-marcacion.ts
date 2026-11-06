import { HttpException } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client';
import type {
  FinPedido,
  PedidoMarcacion,
} from '../interfaces/registro-marcacion.interface';

export const RESULTADOS_REGISTRO_MARCACION = [
  'ACEPTADA',
  'RECHAZADA',
  'ERROR',
] as const;

const objeto = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' ? (v as Record<string, unknown>) : {};

/** Copia apta para jsonb: fechas como texto; lo que no se serializa, marcado. */
export function aJson(v: unknown): Prisma.InputJsonValue {
  try {
    return JSON.parse(JSON.stringify(v ?? null)) as Prisma.InputJsonValue;
  } catch {
    return { noSerializable: true };
  }
}

export function finAceptado(respuesta: unknown, estadoHttp: number): FinPedido {
  const r = objeto(respuesta);
  return {
    resultado: 'ACEPTADA',
    estadoHttp,
    motivo:
      typeof r.mensaje === 'string'
        ? r.mensaje
        : r.estado === 'PENDIENTE'
          ? 'Guardada en Ucheck, pendiente de sincronización'
          : 'Aceptada',
    respuesta: aJson(respuesta),
  };
}

/** 4xx es un "no" a la marca; 5xx o cualquier otra cosa, algo raro. */
export function finDeError(e: unknown): FinPedido {
  const estadoHttp = e instanceof HttpException ? e.getStatus() : 500;
  const cuerpo: unknown =
    e instanceof HttpException
      ? e.getResponse()
      : { message: e instanceof Error ? e.message : String(e) };
  const c = objeto(cuerpo);
  // Los errores de validación traen la lista de campos en `message`.
  const motivo = Array.isArray(c.message)
    ? c.message.join('. ')
    : e instanceof Error
      ? e.message
      : 'Error desconocido';
  return {
    resultado: estadoHttp < 500 ? 'RECHAZADA' : 'ERROR',
    estadoHttp,
    codigo: typeof c.codigo === 'string' ? c.codigo.slice(0, 40) : undefined,
    motivo,
    respuesta: aJson(cuerpo),
  };
}

/** Fila del registro: el pedido completo (parámetros, consulta y cuerpo) y cómo terminó. */
export function filaDePedido(
  pedido: PedidoMarcacion,
  fin: FinPedido,
  duracionMs: number,
): Prisma.RegistroMarcacionCampoCreateInput {
  const cuerpo = objeto(pedido.body);
  const camino = pedido.route?.path ?? (pedido.originalUrl ?? '').split('?')[0];
  const ruta = `${pedido.method} ${camino}`.slice(0, 160);
  const tipo =
    typeof cuerpo.tipo === 'string'
      ? cuerpo.tipo.toUpperCase()
      : /salida/i.test(ruta)
        ? 'SALIDA'
        : 'ENTRADA';
  return {
    ruta,
    tipo: tipo.slice(0, 10),
    usuarioId: pedido.usuarioId,
    ...fin,
    motivo: fin.motivo.slice(0, 1000),
    duracionMs,
    solicitud: aJson({
      params: pedido.params ?? {},
      query: pedido.query ?? {},
      body: pedido.body ?? null,
    }),
  };
}
