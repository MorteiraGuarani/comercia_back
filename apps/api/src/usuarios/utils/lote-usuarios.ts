import { HttpException, Logger } from '@nestjs/common';

const registro = new Logger('UsuariosLote');

/** Mensaje para el usuario de la API; los errores internos no se revelan. */
export function mensajeErrorLote(error: unknown): string {
  if (error instanceof HttpException) {
    const respuesta = error.getResponse();
    const mensaje =
      typeof respuesta === 'object' && respuesta && 'message' in respuesta
        ? respuesta.message
        : respuesta;
    return Array.isArray(mensaje) ? mensaje.join('. ') : String(mensaje);
  }
  registro.error(error);
  return 'No se pudo procesar este usuario';
}

const LOGIN = /^[a-z0-9][a-z0-9._-]{2,29}$/;

/** Usuario de ingreso a partir del correo (lo que va antes de la @), si sirve. */
export function loginDesdeCorreo(correo?: string): string | null {
  const local = (correo ?? '')
    .split('@')[0]
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/^[._-]+/, '')
    .slice(0, 30);
  return LOGIN.test(local) ? local : null;
}
