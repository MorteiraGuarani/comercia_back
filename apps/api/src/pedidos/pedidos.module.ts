import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PlataformaModule } from '../plataforma/plataforma.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CategoriasController } from './categorias.controller';
import { CategoriasService } from './categorias.service';
import { PedidosController } from './pedidos.controller';
import { PedidosService } from './pedidos.service';
import { ServiceLayerService } from './service-layer.service';

@Module({
  imports: [PrismaModule, AuthModule, PlataformaModule],
  controllers: [PedidosController, CategoriasController],
  providers: [PedidosService, ServiceLayerService, CategoriasService],
})
export class PedidosModule {}
