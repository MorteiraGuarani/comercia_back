import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { json } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { RUTAS_LOTE_SOCIOS } from '../../socios-negocio/rutas-socios';

const MB = 1024 * 1024;

/** Cargas masivas de catálogos: rutas que necesitan cuerpos grandes. */
export const RUTA_LOTE_PRODUCTOS =
  '/api/v1/admin/catalogo/empresas/:empresaId/productos';

export function configurarCuerpoHttp(app: NestExpressApplication) {
  const config = app.get(ConfigService);
  const loteBytes = config.getOrThrow<number>('app.httpBodyLimitMb') * MB;
  const generalBytes =
    config.getOrThrow<number>('app.httpBodyLimitGeneralMb') * MB;
  // Va antes del parser general: body-parser no vuelve a leer un cuerpo ya
  // leído, así que el lote conserva su límite y el resto usa el general.
  app.use(RUTA_LOTE_PRODUCTOS, json({ limit: loteBytes }));
  const parserSocios = json({ limit: loteBytes });
  app.use(
    RUTAS_LOTE_SOCIOS,
    (req: Request, res: Response, next: NextFunction) => {
      // app.use consume el prefijo coincidente: solo POST a la colección exacta
      // usa el límite de bulk; ediciones y rutas hijas conservan el límite general.
      if (req.method === 'POST' && (req.path === '/' || req.path === ''))
        return parserSocios(req, res, next);
      next();
    },
  );
  app.useBodyParser('json', { limit: generalBytes });
  app.useBodyParser('urlencoded', { extended: true, limit: generalBytes });
  app.use(
    (error: unknown, _req: Request, res: Response, next: NextFunction) => {
      if (
        typeof error === 'object' &&
        error !== null &&
        'type' in error &&
        error.type === 'entity.too.large'
      ) {
        const limite =
          'limit' in error && typeof error.limit === 'number'
            ? error.limit
            : generalBytes;
        res.status(413).json({
          statusCode: 413,
          error: 'Payload Too Large',
          message: `El cuerpo de la solicitud supera el máximo de ${Math.round(limite / MB)} MB`,
          limitBytes: limite,
        });
        return;
      }
      next(error);
    },
  );
}
