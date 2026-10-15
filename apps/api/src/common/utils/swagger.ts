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
      'Documentacion publica de la API de Comercia. Productos y precios permite todas sus operaciones sin sesion ni token. Las otras secciones mantienen sus permisos.',
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
