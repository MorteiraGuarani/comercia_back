import type { Request } from 'express';

// Request con el id del usuario autenticado, seteado por JwtAuthGuard.
export interface RequestConUsuario extends Request {
  usuarioId: number;
  empresaId: number;
}
