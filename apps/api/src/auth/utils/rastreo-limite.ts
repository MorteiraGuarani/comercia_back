import type { JwtService } from '@nestjs/jwt';
import type { TokenPayload } from '../interfaces/token-payload.interface';
import { tokenSesion, type SolicitudConSesion } from './token-sesion';

// Detrás del proxy todas las solicitudes llegan con la misma IP: con una sesión
// válida (firma verificada) el límite se cuenta por usuario y no se comparte con
// el resto de la empresa. Sin sesión, como en el login, se cuenta por IP.
export function rastreoPorSesion(jwt: Pick<JwtService, 'verify'>) {
  return (req: SolicitudConSesion & { ip?: unknown }): string => {
    const sesion = tokenSesion(req);
    if (sesion) {
      try {
        const { sub } = jwt.verify<TokenPayload>(sesion.token);
        if (Number.isSafeInteger(sub)) return `usuario:${sub}`;
      } catch {
        // Token inválido o vencido: cuenta por IP, como cualquier anónimo.
      }
    }
    return `ip:${typeof req.ip === 'string' ? req.ip : ''}`;
  };
}
