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
      'Documentación pública de la API de Comercia. tbl_oitm es el maestro oficial de artículos; tbl_itm1 contiene precios por lista. Artículos se identifican por ItemCode y socios de tbl_ocrd por CardCode, dentro de empresaId; nunca por id técnico. Precios y líneas usan sus claves compuestas completas (PriceList, ListNum, LINENUM). Ambas tablas y Socios de negocio admiten CRUD y bulk sin sesión. tbl_ospp, tbl_spp1 y tbl_spp2 conservan sesión y permisos de superadministrador. Todos los catálogos se separan por empresa y conservan nombres y mayúsculas de negocio. Las rutas /productos adaptan maestro y precios para la pantalla existente y usan ItemCode/PriceList.',
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
