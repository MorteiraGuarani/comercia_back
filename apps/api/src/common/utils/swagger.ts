import { HttpException, type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NextFunction, Request, Response } from 'express';
import { AUTH_COOKIE } from '../../auth/auth.constants';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { SuperadminGuard } from '../../auth/superadmin.guard';

export function configurarSwagger(app: INestApplication) {
  const config = app.get(ConfigService);
  if (!config.get<boolean>('app.swaggerEnabled')) return;

  // Swagger registra rutas fuera de los controllers: proteger tambien sus
  // archivos estaticos y especificaciones JSON/YAML antes de montarlo.
  if (config.get<string>('app.env') === 'production') {
    const jwt = app.get(JwtAuthGuard);
    const superadmin = app.get(SuperadminGuard);
    app.use(
      ['/api/docs', '/api/docs-json', '/api/docs-yaml'],
      async (req: Request, res: Response, next: NextFunction) => {
        res.setHeader('Cache-Control', 'no-store');
        try {
          const context = new ExecutionContextHost([req, res, next]);
          await jwt.canActivate(context);
          await superadmin.canActivate(context);
          next();
        } catch (error: unknown) {
          const status =
            error instanceof HttpException ? error.getStatus() : 500;
          res.status(status).json({
            statusCode: status,
            message:
              status === 401
                ? 'Sesion no iniciada o expirada'
                : status === 403
                  ? 'Requiere permisos de superadministrador'
                  : 'No se pudo acceder a la documentacion',
          });
        }
      },
    );
  }
  const documentConfig = new DocumentBuilder()
    .setTitle('Comercia API')
    .setDescription(
      'API de Comercia. En produccion, iniciar sesion como superadmin para acceder a esta documentacion. Los endpoints mantienen sus permisos habituales.',
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
