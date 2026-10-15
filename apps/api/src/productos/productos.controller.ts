import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
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
// Sección pública por petición explícita del usuario, incluido su CRUD.
// La empresa de la ruta y los DTOs siguen validándose en cada operación.
export class ProductosController {
  constructor(private readonly servicio: ProductosService) {}

  @Get('empresas')
  empresas(@Query() q: ConsultaCatalogoDto) {
    return this.servicio.empresas(q);
  }

  @Get('empresas/:empresaId/productos/opciones')
  opciones(@Param() p: EmpresaCatalogoParams, @Query() q: ConsultaCatalogoDto) {
    return this.servicio.productos(p.empresaId, q, true);
  }

  @Get('empresas/:empresaId/productos')
  @ApiOperation({
    summary: 'Listar tbl_itm1: una fila por artículo y lista de la empresa',
  })
  @ApiOkResponse({ type: PaginaProductoDto })
  productos(
    @Param() p: EmpresaCatalogoParams,
    @Query() q: ConsultaCatalogoDto,
  ) {
    return this.servicio.productos(p.empresaId, q);
  }

  @Post('empresas/:empresaId/productos')
  @ApiCreatedResponse({ type: ProductoRespuestaDto })
  crear(@Param() p: EmpresaCatalogoParams, @Body() d: CrearProductoDto) {
    return this.servicio.crearProducto(p.empresaId, d);
  }

  @Put('empresas/:empresaId/productos/:id')
  @ApiOkResponse({ type: ProductoRespuestaDto })
  editar(@Param() p: ProductoCatalogoParams, @Body() d: DatosProductoDto) {
    return this.servicio.editarProducto(p.empresaId, p.id, d);
  }

  @Delete('empresas/:empresaId/productos/:id')
  eliminar(@Param() p: ProductoCatalogoParams) {
    return this.servicio.eliminarProducto(p.empresaId, p.id);
  }
}
