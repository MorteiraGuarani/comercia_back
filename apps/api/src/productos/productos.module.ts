import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProductosController } from './productos.controller';
import { ProductosService } from './productos.service';
import { PreciosEspecialesController } from './precios-especiales.controller';
import { PreciosEspecialesService } from './precios-especiales.service';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [ProductosController, PreciosEspecialesController],
  providers: [ProductosService, PreciosEspecialesService],
})
export class ProductosModule {}
