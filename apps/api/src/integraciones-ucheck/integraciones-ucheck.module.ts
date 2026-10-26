import { UcheckModule } from '../ucheck/ucheck.module';
import { Module } from '@nestjs/common';
import { CampoModule } from '../campo/campo.module';
import { PrismaModule } from '../prisma/prisma.module';
import { IntegracionesUcheckController } from './integraciones-ucheck.controller';
import { IntegracionesUcheckService } from './integraciones-ucheck.service';
import { UcheckIntegracionGuard } from './ucheck-integracion.guard';
import { SincronizacionMarcacionesService } from './sincronizacion-marcaciones.service';

@Module({
  imports: [UcheckModule, PrismaModule, CampoModule],
  controllers: [IntegracionesUcheckController],
  providers: [
    IntegracionesUcheckService,
    UcheckIntegracionGuard,
    SincronizacionMarcacionesService,
  ],
})
export class IntegracionesUcheckModule {}
