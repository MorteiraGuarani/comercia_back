import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { crearControladorSocios } from './controlador-tabla';
import { TABLAS_SOCIOS } from './tablas-socios';
import { SociosNegocioService } from './socios-negocio.service';
import { SociosRelacionesController } from './socios-relaciones.controller';

export const CONTROLADORES_SOCIOS = Object.values(TABLAS_SOCIOS).map(
  crearControladorSocios,
);

@Module({
  imports: [PrismaModule],
  controllers: [...CONTROLADORES_SOCIOS, SociosRelacionesController],
  providers: [SociosNegocioService],
})
export class SociosNegocioModule {}
