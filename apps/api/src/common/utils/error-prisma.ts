import {
  BadRequestException,
  ConflictException,
  HttpException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';

/**
 * Código de un error conocido de Prisma ("P2002"...). Se lee por forma y no
 * con instanceof para que funcione igual con el adaptador pg y con los mocks.
 */
export function codigoErrorPrisma(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return null;
  }
  const { code } = error;
  return typeof code === 'string' && /^P\d{4}$/.test(code) ? code : null;
}

/** Violación de un índice único (P2002). */
export function esErrorDuplicado(error: unknown): boolean {
  return codigoErrorPrisma(error) === 'P2002';
}

/** Un duplicado se responde 409 con `mensaje`; cualquier otro error sigue. */
export function relanzarDuplicado(error: unknown, mensaje: string): never {
  if (esErrorDuplicado(error)) throw new ConflictException(mensaje);
  throw error;
}

const SIN_CONEXION = new Set(['P1001', 'P1002', 'P1008', 'P1017', 'P2024']);

/**
 * Traduce los errores de Prisma que no atrapó un servicio a una respuesta
 * HTTP con sentido, en vez de un 500 genérico. Los mensajes no revelan
 * tablas, campos ni datos. Devuelve null si no es un error de Prisma conocido.
 */
export function traducirErrorPrisma(error: unknown): HttpException | null {
  const codigo = codigoErrorPrisma(error);
  if (!codigo) return null;
  if (SIN_CONEXION.has(codigo)) {
    return new ServiceUnavailableException(
      'La base de datos no está disponible en este momento. Probá de nuevo en unos segundos.',
    );
  }
  switch (codigo) {
    case 'P2002':
      return new ConflictException('Ya existe un registro con esos datos');
    case 'P2025':
      return new NotFoundException('Registro no disponible');
    case 'P2003':
      return new ConflictException(
        'No se pudo guardar: hay datos relacionados que lo impiden',
      );
    case 'P2000':
      return new BadRequestException('Un valor supera el largo permitido');
    case 'P2034':
      return new ConflictException(
        'Otro cambio se guardó al mismo tiempo. Probá de nuevo.',
      );
    default:
      return null;
  }
}

/** Columnas del índice único violado, si Prisma las informa. */
export function camposDuplicados(error: unknown): string[] {
  if (typeof error !== 'object' || error === null || !('meta' in error)) {
    return [];
  }
  const meta = error.meta as { target?: unknown } | undefined;
  return Array.isArray(meta?.target)
    ? meta.target.filter((c): c is string => typeof c === 'string')
    : [];
}
