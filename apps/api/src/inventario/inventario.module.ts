import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PlataformaModule } from '../plataforma/plataforma.module';
import { InventarioController } from './inventario.controller';
import { InventarioService } from './inventario.service';

@Module({
  imports: [AuthModule, PrismaModule, PlataformaModule],
  controllers: [InventarioController],
  providers: [InventarioService],
})
export class InventarioModule {}
