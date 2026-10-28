import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NextFunction, Request, Response } from 'express';
import { AUTH_COOKIE } from '../../auth/auth.constants';

export function configurarSwagger(app: INestApplication) {
  const config = app.get(ConfigService);
  if (!config.get<boolean>('app.swaggerEnabled')) return;

  // Documentación pública por decisión del usuario. Los guards de cada
  // endpoint siguen validando la ejecución de las operaciones desde Swagger.
  app.use(
    ['/api/docs', '/api/docs-json', '/api/docs-yaml'],
    (_req: Request, res: Response, next: NextFunction) => {
      res.setHeader('Cache-Control', 'no-store');
      next();
    },
  );
  const documentConfig = new DocumentBuilder()
    .setTitle('Comercia API')
    .setDescription(
      'Documentación pública de la API de Comercia. Las rutas por tabla tbl_* son públicas y admiten carga individual o bulk. tbl_oitm es un maestro global de artículos compartido por todas las empresas. Las demás tablas, incluida tbl_itm1 con los precios por lista, se separan por empresa. tbl_omrc, tbl_oscn y tbl_oitb completan el catálogo de artículos, y tbl_jtiposubcanales los catálogos de socios. Las rutas /productos adaptan artículos y precios para la pantalla existente.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .addCookieAuth(AUTH_COOKIE)
    .build();
  const document = SwaggerModule.createDocument(app, documentConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: false, withCredentials: true },
  });
}
