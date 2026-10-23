import { Module } from '@nestjs/common';
import { CampoModule } from '../campo/campo.module';
import { PrismaModule } from '../prisma/prisma.module';
import { UbicacionesModule } from '../ubicaciones/ubicaciones.module';
import { IntegracionesUcheckController } from './integraciones-ucheck.controller';
import { IntegracionesUcheckService } from './integraciones-ucheck.service';
import { UcheckIntegracionGuard } from './ucheck-integracion.guard';

@Module({
  imports: [PrismaModule, CampoModule, UbicacionesModule],
  controllers: [IntegracionesUcheckController],
  providers: [IntegracionesUcheckService, UcheckIntegracionGuard],
})
export class IntegracionesUcheckModule {}
