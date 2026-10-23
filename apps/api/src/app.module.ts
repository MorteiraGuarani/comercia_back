import { Module } from '@nestjs/common';
import { ToleranciasModule } from './tolerancias/tolerancias.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { rastreoPorSesion } from './auth/utils/rastreo-limite';
import { config as cargarEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import configuration from './config/configuration';
import { validateEnv } from './config/env.schema';
import { EmpresasModule } from './empresas/empresas.module';
import { HealthModule } from './health/health.module';
import { PlataformaModule } from './plataforma/plataforma.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { RolesModule } from './roles/roles.module';
import { ProductosModule } from './productos/productos.module';
import { CampoModule } from './campo/campo.module';
import { IntegracionesUcheckModule } from './integraciones-ucheck/integraciones-ucheck.module';
import { InventarioModule } from './inventario/inventario.module';
import { UbicacionesModule } from './ubicaciones/ubicaciones.module';
import { SociosNegocioModule } from './socios-negocio/socios-negocio.module';

const usaBaseProduccion = process.env.COMERCIA_DATABASE_TARGET === 'production';

if (process.env.NODE_ENV !== 'production' && !usaBaseProduccion) {
  const rutasEntornoLocal = [
    resolve(process.cwd(), '.env.development'),
    resolve(process.cwd(), '../../.env.development'),
  ];
  const entornoLocal = rutasEntornoLocal.find(existsSync);
  if (entornoLocal) cargarEnv({ path: entornoLocal, override: true });
}

@Module({
  imports: [
    ToleranciasModule,
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath:
        process.env.NODE_ENV === 'production' || usaBaseProduccion
          ? ['.env', '../../.env']
          : ['../../.env.development', '.env', '../../.env'],
      validate: validateEnv,
      load: [configuration],
    }),
    ThrottlerModule.forRootAsync({
      imports: [AuthModule],
      inject: [ConfigService, JwtService],
      useFactory: (configService: ConfigService, jwt: JwtService) => ({
        throttlers: [
          {
            ttl: configService.getOrThrow<number>('security.throttleTtl'),
            limit: configService.getOrThrow<number>('security.throttleLimit'),
          },
        ],
        // Por usuario con sesión válida; por IP sin sesión (ver rastreo-limite).
        getTracker: rastreoPorSesion(jwt),
      }),
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    EmpresasModule,
    RolesModule,
    ProductosModule,
    SociosNegocioModule,
    CampoModule,
    InventarioModule,
    UbicacionesModule,
    IntegracionesUcheckModule,
    PlataformaModule,
    UsuariosModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
