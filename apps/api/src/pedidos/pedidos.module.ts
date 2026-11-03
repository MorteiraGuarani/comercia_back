import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CategoriasController } from './categorias.controller';
import { CategoriasService } from './categorias.service';
import { PedidosController } from './pedidos.controller';
import { PedidosService } from './pedidos.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [PedidosController, CategoriasController],
  providers: [PedidosService, CategoriasService],
})
export class PedidosModule {}
