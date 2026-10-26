import { HttpException } from '@nestjs/common';

/** Motivo que se le informa a Ucheck cuando una marcación no se pudo guardar. */
export function mensajeErrorUcheck(error: unknown): string {
  if (error instanceof HttpException) {
    const r = error.getResponse();
    const m = typeof r === 'object' && r && 'message' in r ? r.message : r;
    return (Array.isArray(m) ? m.join('. ') : String(m)).slice(0, 1000);
  }
  return 'Error interno de Comercia al guardar la marcación';
}
