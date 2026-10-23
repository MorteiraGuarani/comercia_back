import { BadRequestException, type ValidationError } from '@nestjs/common';
import type {
  ErrorCampo,
  FilaInvalida,
  LoteValidado,
} from '../interfaces/error-validacion.interface';

/** Con 50.000 filas se informan las primeras, no todas. */
export const MAX_FILAS_INVALIDAS = 100;
/** Tope de filas detalladas en el resumen de un bulk que no se corta. */
export const MAX_FILAS_INFORMADAS = 1000;

export function erroresPorCampo(
  errores: ValidationError[],
  prefijo = '',
): ErrorCampo[] {
  return errores.flatMap((e) => {
    const campo = prefijo ? `${prefijo}.${e.property}` : e.property;
    return [
      ...(e.constraints
        ? [
            {
              campo,
              valor: e.value as unknown,
              mensajes: Object.values(e.constraints),
            },
          ]
        : []),
      ...erroresPorCampo(e.children ?? [], campo),
    ];
  });
}

/** exceptionFactory de ValidationPipe: cada mensaje dice su campo. */
export function excepcionConCampos(errores: ValidationError[]) {
  const campos = erroresPorCampo(errores);
  return new BadRequestException({
    statusCode: 400,
    message: campos.flatMap((c) => c.mensajes.map((m) => `${c.campo}: ${m}`)),
    error: 'Bad Request',
    errores: campos,
  });
}

const muestra = (valor: unknown) => {
  const texto = JSON.stringify(valor) ?? 'sin valor';
  return texto.length > 60 ? `${texto.slice(0, 57)}...` : texto;
};

function resumen(errores: ErrorCampo[], details: string | object) {
  if (errores.length)
    return errores
      .map((e) => `${e.campo} = ${muestra(e.valor)}: ${e.mensajes.join('; ')}`)
      .join(' | ');
  if (typeof details === 'string') return details;
  const m = (details as { message?: string | string[] }).message;
  return Array.isArray(m) ? m.join('; ') : (m ?? '');
}

export function filaInvalida(
  index: number,
  error: BadRequestException,
): FilaInvalida {
  const details = error.getResponse();
  const errores =
    typeof details === 'object' && 'errores' in details
      ? (details as { errores: ErrorCampo[] }).errores
      : [];
  return {
    index,
    fila: index + 1,
    errores,
    motivo: resumen(errores, details),
    details,
  };
}

/** Fila válida para el DTO que la base no puede guardar (ej. referencia ausente). */
export function filaRechazada(
  index: number,
  campo: string,
  valor: unknown,
  mensaje: string,
): FilaInvalida {
  const errores = [{ campo, valor, mensajes: [mensaje] }];
  return {
    index,
    fila: index + 1,
    errores,
    motivo: resumen(errores, mensaje),
    details: mensaje,
  };
}

/** Normaliza lo que recibe un servicio: lote validado, arreglo u objeto suelto. */
export function comoLote(datos: unknown): LoteValidado | null {
  if (Array.isArray(datos))
    return {
      filas: datos as Record<string, unknown>[],
      indices: datos.map((_, i) => i),
      invalidas: [],
      recibidos: datos.length,
    };
  const lote = datos as LoteValidado | null;
  return lote && Array.isArray(lote.filas) && Array.isArray(lote.invalidas)
    ? lote
    : null;
}

/** Parte del resumen del bulk con las filas salteadas y por qué. */
export function resumenInvalidas(invalidas: FilaInvalida[]) {
  return {
    invalidas: invalidas.length,
    filasInvalidas: [...invalidas]
      .sort((a, b) => a.index - b.index)
      .slice(0, MAX_FILAS_INFORMADAS)
      .map(({ index, fila, errores, motivo }) => ({
        index,
        fila,
        errores,
        motivo,
      })),
  };
}

/** Un solo 400 con todas las filas inválidas encontradas (hasta el tope). */
export function excepcionLote(invalidas: FilaInvalida[]) {
  const [primera] = invalidas;
  const otras =
    invalidas.length > 1
      ? `. Hay ${invalidas.length}${invalidas.length >= MAX_FILAS_INVALIDAS ? ' o más' : ''} filas con errores, detalladas en filasInvalidas`
      : '';
  return new BadRequestException({
    statusCode: 400,
    message: `Fila ${primera.fila} inválida — ${primera.motivo}${otras}`,
    index: primera.index,
    errores: primera.errores,
    details: primera.details,
    filasInvalidas: invalidas.map((f) => ({
      index: f.index,
      fila: f.fila,
      errores: f.errores,
      motivo: f.motivo,
    })),
  });
}
