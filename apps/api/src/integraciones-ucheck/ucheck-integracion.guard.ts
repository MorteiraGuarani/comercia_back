import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

@Injectable()
export class UcheckIntegracionGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const secreto = this.config.get<string>('integrations.ucheckSecret');
    if (!secreto)
      throw new ServiceUnavailableException(
        'La integración con UCHECK no está configurada',
      );
    const autorizacion = context.switchToHttp().getRequest<Request>()
      .headers.authorization;
    const token = autorizacion?.startsWith('Bearer ')
      ? autorizacion.slice(7)
      : '';
    const esperado = Buffer.from(secreto);
    const recibido = Buffer.from(token);
    if (
      esperado.length !== recibido.length ||
      !timingSafeEqual(esperado, recibido)
    )
      throw new UnauthorizedException('Credencial de integración inválida');
    return true;
  }
}
