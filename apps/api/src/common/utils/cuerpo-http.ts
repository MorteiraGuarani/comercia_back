import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';

export function configurarCuerpoHttp(app: NestExpressApplication) {
  const limiteMb = app
    .get(ConfigService)
    .getOrThrow<number>('app.httpBodyLimitMb');
  const limiteBytes = limiteMb * 1024 * 1024;
  app.useBodyParser('json', { limit: limiteBytes });
  app.useBodyParser('urlencoded', {
    extended: true,
    limit: limiteBytes,
    parameterLimit: 100_000,
  });
  app.use(
    (error: unknown, _req: Request, res: Response, next: NextFunction) => {
      if (
        typeof error === 'object' &&
        error !== null &&
        'type' in error &&
        error.type === 'entity.too.large'
      ) {
        res.status(413).json({
          statusCode: 413,
          error: 'Payload Too Large',
          message: `El cuerpo de la solicitud supera el máximo de ${limiteMb} MB`,
          limitBytes: limiteBytes,
        });
        return;
      }
      next(error);
    },
  );
}
