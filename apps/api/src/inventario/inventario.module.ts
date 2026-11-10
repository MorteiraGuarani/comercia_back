import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PlataformaModule } from '../plataforma/plataforma.module';
import { InventarioCargasController } from './inventario-cargas.controller';
import { InventarioCargasService } from './inventario-cargas.service';
import { InventarioController } from './inventario.controller';
import { InventarioLocalService } from './inventario-local.service';
import { VencimientosService } from './vencimientos.service';

@Module({
  imports: [AuthModule, PrismaModule, PlataformaModule],
  controllers: [InventarioController, InventarioCargasController],
  providers: [
    InventarioLocalService,
    InventarioCargasService,
    VencimientosService,
  ],
})
export class InventarioModule {}
