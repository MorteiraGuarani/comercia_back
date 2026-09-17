import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PlataformaModule } from '../plataforma/plataforma.module';
import { CampoController } from './campo.controller';
import { CampoAccesoService } from './campo-acceso.service';
import { CatalogoCampoService } from './catalogo-campo.service';
import { PlanificacionCampoService } from './planificacion-campo.service';
import { JornadaCampoService } from './jornada-campo.service';
import { ComentarioService } from './services/comentario.service';
import { FotoService } from './services/foto.service';
import { NotificacionService } from './services/notificacion.service';
import { NovedadService } from './services/novedad.service';
import { AvisoService } from './services/aviso.service';
import { SupervisionService } from './services/supervision.service';

@Module({
  imports: [AuthModule, PrismaModule, PlataformaModule],
  controllers: [CampoController],
  providers: [
    CampoAccesoService,
    CatalogoCampoService,
    PlanificacionCampoService,
    JornadaCampoService,
    ComentarioService,
    FotoService,
    NotificacionService,
    NovedadService,
    AvisoService,
    SupervisionService,
  ],
  exports: [
    CampoAccesoService,
    JornadaCampoService,
    NovedadService,
    AvisoService,
    SupervisionService,
  ],
})
export class CampoModule {}
