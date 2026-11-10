import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
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
import { PedidosAccesoGuard } from './pedidos-acceso.guard';
import type { RequestConUsuario } from '../auth/interfaces/request-con-usuario.interface';
import { CardCodePipe } from '../common/pipes/card-code.pipe';
import {
  BuscarClientesPedidoDto,
  BuscarProductosPedidoDto,
  ConsultaPedidosDto,
  CopiarPedidoDto,
  CrearPedidoDto,
  EditarDocumentoDto,
} from './dto/pedido.dto';
import { PedidosService } from './pedidos.service';

@ApiTags('Pedidos')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Sesión requerida' })
@ApiForbiddenResponse({ description: 'Sin acceso a pedidos' })
@Controller('pedidos')
// shortcut: Pedidos en pruebas con Admin TI y usuarios fijos; pasar a exigirAccesoPagina cuando se habilite por Acceso por empresa.
@UseGuards(JwtAuthGuard, PedidosAccesoGuard)
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

  // Sin paginar: el SP de SAP devuelve como máximo 4 facturas.
  @Get('clientes/:cardCode/facturas')
  @ApiOperation({ summary: 'Últimas 4 facturas del cliente en SAP' })
  facturas(
    @Req() req: RequestConUsuario,
    @Param('cardCode', CardCodePipe) cardCode: string,
  ) {
    return this.servicio.facturas(req.usuarioId, cardCode);
  }

  @Get('clientes/:cardCode/facturas/:docEntry')
  @ApiOperation({
    summary: 'Líneas de una de las últimas facturas del cliente',
  })
  detalleFactura(
    @Req() req: RequestConUsuario,
    @Param('cardCode', CardCodePipe) cardCode: string,
    @Param('docEntry', ParseIntPipe) docEntry: number,
  ) {
    return this.servicio.detalleFactura(req.usuarioId, cardCode, docEntry);
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
  listar(@Req() req: RequestConUsuario, @Query() query: ConsultaPedidosDto) {
    return this.servicio.listar(req.usuarioId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Pedido propio con sus documentos para SAP' })
  detalle(
    @Req() req: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.servicio.detalle(req.usuarioId, id);
  }

  @Post('documentos/:id/enviar')
  @HttpCode(200)
  @ApiOperation({ summary: 'Enviar a SAP un documento propio' })
  enviarDocumento(
    @Req() req: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.servicio.enviarDocumento(req.usuarioId, id);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar un pedido propio que no se envió a SAP' })
  eliminar(
    @Req() req: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.servicio.eliminar(req.usuarioId, id);
  }

  @Patch('documentos/:id')
  @ApiOperation({
    summary: 'Editar un documento propio que todavía no se envió a SAP',
  })
  editarDocumento(
    @Req() req: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EditarDocumentoDto,
  ) {
    return this.servicio.editarDocumento(req.usuarioId, id, dto);
  }

  @Post('copia')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Productos de otro pedido con los precios vigentes del cliente',
  })
  copiar(@Req() req: RequestConUsuario, @Body() dto: CopiarPedidoDto) {
    return this.servicio.copiar(req.usuarioId, dto);
  }

  @Post()
  @ApiOperation({
    summary:
      'Guardar un pedido con sus documentos y, si se pide, enviarlos a SAP',
  })
  crear(@Req() req: RequestConUsuario, @Body() dto: CrearPedidoDto) {
    return this.servicio.crear(req.usuarioId, dto);
  }
}
