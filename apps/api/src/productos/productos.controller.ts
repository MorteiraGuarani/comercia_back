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
  ApiBody,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiOperation,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { ProductosService } from './productos.service';
import { CrearProductosPipe } from './pipes/crear-productos.pipe';
import { MAX_PRODUCTOS_POR_LOTE } from './productos.constants';
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
@ApiExtraModels(CrearProductoDto, ProductoRespuestaDto)
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
    description:
      'itemcode puede repetirse con distinto pricelist. La clave primaria es (empresa_id, itemcode, pricelist).',
  })
  @ApiOkResponse({ type: PaginaProductoDto })
  productos(
    @Param() p: EmpresaCatalogoParams,
    @Query() q: ConsultaCatalogoDto,
  ) {
    return this.servicio.productos(p.empresaId, q);
  }

  @Post('empresas/:empresaId/productos')
  @ApiOperation({
    summary: 'Crear un artículo o un lote de artículos y listas',
    description: `Acepta un objeto o un arreglo de 1 a ${MAX_PRODUCTOS_POR_LOTE} objetos, dentro del límite HTTP configurado (50 MB por defecto). Permite el mismo itemcode en listas diferentes. El lote es atómico: si una fila es inválida (400) o repite itemcode y pricelist en la empresa (409), no se guarda ninguna. La respuesta conserva el formato y orden de entrada.`,
  })
  @ApiBody({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(CrearProductoDto) },
        {
          type: 'array',
          minItems: 1,
          maxItems: MAX_PRODUCTOS_POR_LOTE,
          items: { $ref: getSchemaPath(CrearProductoDto) },
        },
      ],
    },
    examples: {
      individual: {
        summary: 'Un artículo y lista',
        value: {
          itemcode: 'AV00018',
          itemname: 'PAPAS TRAD. 9,5 MM 4X2.5 KG-XL',
          iva: 10,
          itmsgrpcode: 143,
          pricelist: 13,
          price: 141650,
          tipo: null,
        },
      },
      lote: {
        summary: 'Mismo artículo en listas distintas',
        value: [13, 14, 16, 21, 22].map((pricelist) => ({
          itemcode: 'AV00018',
          itemname: 'PAPAS TRAD. 9,5 MM 4X2.5 KG-XL',
          iva: 10,
          itmsgrpcode: 143,
          pricelist,
          price: 141650,
          tipo: null,
        })),
      },
    },
  })
  @ApiCreatedResponse({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(ProductoRespuestaDto) },
        {
          type: 'array',
          items: { $ref: getSchemaPath(ProductoRespuestaDto) },
        },
      ],
    },
  })
  crear(
    @Param() p: EmpresaCatalogoParams,
    @Body(CrearProductosPipe) d: CrearProductoDto | CrearProductoDto[],
  ) {
    return Array.isArray(d)
      ? this.servicio.crearProductos(p.empresaId, d)
      : this.servicio.crearProducto(p.empresaId, d);
  }

  @Put('empresas/:empresaId/productos/:id')
  @ApiOperation({
    summary: 'Editar un artículo de una lista por su ID',
    description:
      'id continúa siendo único. Cambiar itemcode o pricelist no puede duplicar la combinación dentro de la empresa (409).',
  })
  @ApiOkResponse({ type: ProductoRespuestaDto })
  editar(@Param() p: ProductoCatalogoParams, @Body() d: DatosProductoDto) {
    return this.servicio.editarProducto(p.empresaId, p.id, d);
  }

  @Delete('empresas/:empresaId/productos/:id')
  eliminar(@Param() p: ProductoCatalogoParams) {
    return this.servicio.eliminarProducto(p.empresaId, p.id);
  }
}
