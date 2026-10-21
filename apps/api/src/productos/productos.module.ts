import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProductosController } from './productos.controller';
import { ProductosService } from './productos.service';
import { crearControladorTablaProductos } from './controlador-tabla-productos';
import { TablasProductosService } from './tablas-productos.service';
import { TABLAS_PRODUCTOS } from './tablas-productos';

export const CONTROLADORES_TABLAS_PRODUCTOS = Object.values(
  TABLAS_PRODUCTOS,
).map(crearControladorTablaProductos);

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [ProductosController, ...CONTROLADORES_TABLAS_PRODUCTOS],
  providers: [ProductosService, TablasProductosService],
})
export class ProductosModule {}
