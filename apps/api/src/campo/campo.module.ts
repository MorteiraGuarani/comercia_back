import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PlataformaModule } from '../plataforma/plataforma.module';
import { CampoController } from './campo.controller';
import { CampoAccesoService } from './campo-acceso.service';
import { CatalogoCampoService } from './catalogo-campo.service';
import { PlanificacionCampoService } from './planificacion-campo.service';
import { JornadaCampoService } from './jornada-campo.service';

@Module({
  imports: [AuthModule, PrismaModule, PlataformaModule],
  controllers: [CampoController],
  providers: [
    CampoAccesoService,
    CatalogoCampoService,
    PlanificacionCampoService,
    JornadaCampoService,
  ],
  exports: [CampoAccesoService, JornadaCampoService],
})
export class CampoModule {}
