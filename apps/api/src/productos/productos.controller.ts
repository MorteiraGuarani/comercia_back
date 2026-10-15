import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SuperadminGuard } from '../auth/superadmin.guard';
import type { RequestConUsuario } from '../auth/interfaces/request-con-usuario.interface';
import { ProductosService } from './productos.service';
import {
  ConsultaCatalogoDto,
  CrearProductoDto,
  DatosProductoDto,
  EmpresaCatalogoParams,
  ProductoCatalogoParams,
  ProductoRespuestaDto,
  PaginaProductoDto,
} from './dto/catalogo.dto';

@Controller('admin/catalogo')
@ApiTags('Productos y precios')
@ApiBearerAuth()
@ApiCookieAuth()
@UseGuards(JwtAuthGuard, SuperadminGuard)
export class ProductosController {
  constructor(private readonly servicio: ProductosService) {}

  @Get('empresas')
  empresas(@Req() r: RequestConUsuario, @Query() q: ConsultaCatalogoDto) {
    return this.servicio.empresas(r.usuarioId, q);
  }

  @Get('empresas/:empresaId/productos/opciones')
  opciones(
    @Req() r: RequestConUsuario,
    @Param() p: EmpresaCatalogoParams,
    @Query() q: ConsultaCatalogoDto,
  ) {
    return this.servicio.productos(r.usuarioId, p.empresaId, q, true);
  }

  @Get('empresas/:empresaId/productos')
  @ApiOperation({
    summary: 'Listar tbl_itm1: una fila por artículo y lista de la empresa',
  })
  @ApiOkResponse({ type: PaginaProductoDto })
  productos(
    @Req() r: RequestConUsuario,
    @Param() p: EmpresaCatalogoParams,
    @Query() q: ConsultaCatalogoDto,
  ) {
    return this.servicio.productos(r.usuarioId, p.empresaId, q);
  }

  @Post('empresas/:empresaId/productos')
  @ApiCreatedResponse({ type: ProductoRespuestaDto })
  crear(
    @Req() r: RequestConUsuario,
    @Param() p: EmpresaCatalogoParams,
    @Body() d: CrearProductoDto,
  ) {
    return this.servicio.crearProducto(r.usuarioId, p.empresaId, d);
  }

  @Put('empresas/:empresaId/productos/:id')
  @ApiOkResponse({ type: ProductoRespuestaDto })
  editar(
    @Req() r: RequestConUsuario,
    @Param() p: ProductoCatalogoParams,
    @Body() d: DatosProductoDto,
  ) {
    return this.servicio.editarProducto(r.usuarioId, p.empresaId, p.id, d);
  }

  @Delete('empresas/:empresaId/productos/:id')
  eliminar(@Req() r: RequestConUsuario, @Param() p: ProductoCatalogoParams) {
    return this.servicio.eliminarProducto(r.usuarioId, p.empresaId, p.id);
  }
}
