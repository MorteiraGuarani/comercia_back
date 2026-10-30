import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import {
  AdminAccesosController,
  AdminPlataformaController,
  MiPlataformaController,
} from './plataforma.controller';
import { ModulosService } from './modulos.service';
import { EjecutablesService } from './ejecutables.service';
import { AsignacionesService } from './asignaciones.service';
import { MiPlataformaService } from './mi-plataforma.service';
import { AccesoPlataformaService } from './acceso-plataforma.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [
    MiPlataformaController,
    AdminPlataformaController,
    AdminAccesosController,
  ],
  providers: [
    ModulosService,
    EjecutablesService,
    AsignacionesService,
    MiPlataformaService,
    AccesoPlataformaService,
  ],
  // Otros módulos (ej. locales) lo usan para autorizar el acceso a sus datos
  exports: [AccesoPlataformaService],
})
export class PlataformaModule {}
