import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminTiGuard } from '../auth/admin-ti.guard';
import type { RequestConUsuario } from '../auth/interfaces/request-con-usuario.interface';
import { CardCodePipe } from '../common/pipes/card-code.pipe';
import { PaginacionDto } from '../common/utils/paginacion';
import {
  BuscarClientesPedidoDto,
  BuscarProductosPedidoDto,
  CrearPedidoDto,
} from './dto/pedido.dto';
import { PedidosService } from './pedidos.service';

@ApiTags('Pedidos')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Sesión requerida' })
@ApiForbiddenResponse({ description: 'Sin acceso a pedidos' })
@Controller('pedidos')
// shortcut: Pedidos se arma solo con Admin TI; pasar a exigirAccesoPagina cuando se habilite por Acceso por empresa.
@UseGuards(JwtAuthGuard, AdminTiGuard)
export class PedidosController {
  constructor(private readonly servicio: PedidosService) {}

  @Get('clientes')
  @ApiOperation({
    summary: 'Buscar clientes de tbl_ocrd habilitados para cargar un pedido',
  })
  clientes(
    @Req() req: RequestConUsuario,
    @Query() query: BuscarClientesPedidoDto,
  ) {
    return this.servicio.clientes(req.usuarioId, query);
  }

  @Get('clientes/:cardCode')
  @ApiOperation({ summary: 'Perfil del cliente para el paso 1 del pedido' })
  perfil(
    @Req() req: RequestConUsuario,
    @Param('cardCode', CardCodePipe) cardCode: string,
  ) {
    return this.servicio.perfil(req.usuarioId, cardCode);
  }

  @Get('productos')
  @ApiOperation({
    summary:
      'Productos activos de una línea con el precio de la lista del cliente',
  })
  productos(
    @Req() req: RequestConUsuario,
    @Query() query: BuscarProductosPedidoDto,
  ) {
    return this.servicio.productos(req.usuarioId, query);
  }

  @Get()
  @ApiOperation({ summary: 'Pedidos cargados por el usuario' })
  listar(@Req() req: RequestConUsuario, @Query() query: PaginacionDto) {
    return this.servicio.listar(req.usuarioId, query);
  }

  @Post()
  @ApiOperation({
    summary: 'Guardar un pedido en Comercia (todavía no se envía a SAP)',
  })
  crear(@Req() req: RequestConUsuario, @Body() dto: CrearPedidoDto) {
    return this.servicio.crear(req.usuarioId, dto);
  }
}
