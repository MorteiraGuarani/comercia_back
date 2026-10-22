import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PlataformaModule } from '../plataforma/plataforma.module';
import { InventarioController } from './inventario.controller';
import { InventarioLocalService } from './inventario-local.service';
import { VencimientosService } from './vencimientos.service';

@Module({
  imports: [AuthModule, PrismaModule, PlataformaModule],
  controllers: [InventarioController],
  providers: [InventarioLocalService, VencimientosService],
})
export class InventarioModule {}
