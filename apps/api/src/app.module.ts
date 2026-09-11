import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
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
import { CampoModule } from './campo/campo.module';
import { IntegracionesUcheckModule } from './integraciones-ucheck/integraciones-ucheck.module';

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
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [
        {
          ttl: configService.getOrThrow<number>('security.throttleTtl'),
          limit: configService.getOrThrow<number>('security.throttleLimit'),
        },
      ],
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    EmpresasModule,
    RolesModule,
    CampoModule,
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
