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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiBearerAuth, ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { SuperadminGuard } from '../auth/superadmin.guard';
import type { RequestConUsuario } from '../auth/interfaces/request-con-usuario.interface';
import { ProductosService } from './productos.service';
import {
  ConsultaCatalogoDto,
  CrearProductoDto,
  DatosProductoDto,
  EmpresaCatalogoParams,
  PrecioCatalogoDto,
  PrecioCatalogoParams,
  ProductoCatalogoParams,
} from './dto/catalogo.dto';

@Controller('admin/catalogo')
@ApiTags('Productos y precios')
@ApiBearerAuth()
@ApiCookieAuth()
@UseGuards(JwtAuthGuard, SuperadminGuard)
export class ProductosController {
  constructor(private readonly servicio: ProductosService) {}
  @Get('empresas') empresas(
    @Req() r: RequestConUsuario,
    @Query() q: ConsultaCatalogoDto,
  ) {
    return this.servicio.empresas(r.usuarioId, q);
  }
  @Get('empresas/:empresaId/productos/opciones') opciones(
    @Req() r: RequestConUsuario,
    @Param() p: EmpresaCatalogoParams,
    @Query() q: ConsultaCatalogoDto,
  ) {
    return this.servicio.productos(r.usuarioId, p.empresaId, q, true);
  }
  @Get('empresas/:empresaId/productos') productos(
    @Req() r: RequestConUsuario,
    @Param() p: EmpresaCatalogoParams,
    @Query() q: ConsultaCatalogoDto,
  ) {
    return this.servicio.productos(r.usuarioId, p.empresaId, q);
  }
  @Post('empresas/:empresaId/productos') crear(
    @Req() r: RequestConUsuario,
    @Param() p: EmpresaCatalogoParams,
    @Body() d: CrearProductoDto,
  ) {
    return this.servicio.crearProducto(r.usuarioId, p.empresaId, d);
  }
  @Put('empresas/:empresaId/productos/:cardCode') editar(
    @Req() r: RequestConUsuario,
    @Param() p: ProductoCatalogoParams,
    @Body() d: DatosProductoDto,
  ) {
    return this.servicio.editarProducto(
      r.usuarioId,
      p.empresaId,
      p.cardCode,
      d,
    );
  }
  @Delete('empresas/:empresaId/productos/:cardCode') eliminar(
    @Req() r: RequestConUsuario,
    @Param() p: ProductoCatalogoParams,
  ) {
    return this.servicio.eliminarProducto(r.usuarioId, p.empresaId, p.cardCode);
  }
  @Get('empresas/:empresaId/precios') precios(
    @Req() r: RequestConUsuario,
    @Param() p: EmpresaCatalogoParams,
    @Query() q: ConsultaCatalogoDto,
  ) {
    return this.servicio.precios(r.usuarioId, p.empresaId, q);
  }
  @Post('empresas/:empresaId/precios') crearPrecio(
    @Req() r: RequestConUsuario,
    @Param() p: EmpresaCatalogoParams,
    @Body() d: PrecioCatalogoDto,
  ) {
    return this.servicio.guardarPrecio(r.usuarioId, p.empresaId, d);
  }
  @Put('empresas/:empresaId/precios/:id') editarPrecio(
    @Req() r: RequestConUsuario,
    @Param() p: PrecioCatalogoParams,
    @Body() d: PrecioCatalogoDto,
  ) {
    return this.servicio.guardarPrecio(r.usuarioId, p.empresaId, d, p.id);
  }
  @Delete('empresas/:empresaId/precios/:id') eliminarPrecio(
    @Req() r: RequestConUsuario,
    @Param() p: PrecioCatalogoParams,
  ) {
    return this.servicio.eliminarPrecio(r.usuarioId, p.empresaId, p.id);
  }
}
