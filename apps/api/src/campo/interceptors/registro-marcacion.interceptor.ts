import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { catchError, from, mergeMap, type Observable, throwError } from 'rxjs';
import { RegistroMarcacionesService } from '../services/registro-marcaciones.service';
import type {
  FinPedido,
  PedidoMarcacion,
} from '../interfaces/registro-marcacion.interface';
import {
  filaDePedido,
  finAceptado,
  finDeError,
} from '../utils/registro-marcacion';

/**
 * Va en cada endpoint de marca de campo: guarda el pedido completo y su
 * resultado (aceptada, rechazada por Comercia o por Ucheck, o con error),
 * también si falla la validación. Lo que corta el guard (sin sesión) no llega acá.
 */
@Injectable()
export class RegistroMarcacionInterceptor implements NestInterceptor {
  constructor(private readonly registro: RegistroMarcacionesService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const pedido = ctx.switchToHttp().getRequest<PedidoMarcacion>();
    const estadoOk =
      (Reflect.getMetadata(HTTP_CODE_METADATA, ctx.getHandler()) as
        number | undefined) ?? (pedido.method === 'POST' ? 201 : 200);
    const inicio = Date.now();
    const guardar = (fin: FinPedido) =>
      this.registro.registrar(filaDePedido(pedido, fin, Date.now() - inicio));
    return next.handle().pipe(
      mergeMap(async (respuesta: unknown) => {
        await guardar(finAceptado(respuesta, estadoOk));
        return respuesta;
      }),
      catchError((e: unknown) =>
        from(guardar(finDeError(e))).pipe(mergeMap(() => throwError(() => e))),
      ),
    );
  }
}
