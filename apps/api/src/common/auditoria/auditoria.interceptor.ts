import { AsyncLocalStorage } from 'node:async_hooks';
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import type { RequestConUsuario } from '../../auth/interfaces/request-con-usuario.interface';

/** Quién hace el pedido en curso, para que los services no tengan que pasarlo al log. */
export const actorAuditoria = new AsyncLocalStorage<{ usuarioId: number }>();

/** Global: corre cada handler con el usuario que dejó JwtAuthGuard. */
@Injectable()
export class AuditoriaInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const { usuarioId } = context
      .switchToHttp()
      .getRequest<Partial<RequestConUsuario>>();
    // Nest ata el handler al contexto async de next.handle(), así que alcanza con run().
    return usuarioId
      ? actorAuditoria.run({ usuarioId }, () => next.handle())
      : next.handle();
  }
}
