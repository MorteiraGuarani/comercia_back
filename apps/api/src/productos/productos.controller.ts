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
  LoteProductosRespuestaDto,
} from './dto/catalogo.dto';

@Controller('admin/catalogo')
@ApiTags('Productos y precios · pantalla compatible')
@ApiExtraModels(
  CrearProductoDto,
  ProductoRespuestaDto,
  LoteProductosRespuestaDto,
)
// Sección pública por petición explícita del usuario, incluido su CRUD.
// La empresa de la ruta y los DTOs siguen validándose en cada operación.
export class ProductosController {
  constructor(private readonly servicio: ProductosService) {}

  @Get('empresas')
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: { id: { type: 'integer' }, nombre: { type: 'string' } },
          },
        },
        total: { type: 'integer' },
        page: { type: 'integer' },
        limit: { type: 'integer' },
        totalPages: { type: 'integer' },
      },
    },
    example: {
      items: [{ id: 1, nombre: 'Empresa de ejemplo' }],
      total: 1,
      page: 1,
      limit: 7,
      totalPages: 1,
    },
  })
  @ApiOperation({
    summary: 'Listar empresas del catálogo público',
    description:
      'Sin login ni token. Listado paginado: 7 registros por defecto, máximo 50; buscar filtra nombre.',
  })
  empresas(@Query() q: ConsultaCatalogoDto) {
    return this.servicio.empresas(q);
  }

  @Get('empresas/:empresaId/productos/opciones')
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: { id: { type: 'string' }, nombre: { type: 'string' } },
          },
        },
        total: { type: 'integer' },
        page: { type: 'integer' },
        limit: { type: 'integer' },
        totalPages: { type: 'integer' },
      },
    },
    example: {
      items: [{ id: '1', nombre: 'A0001 · Artículo · Lista 1' }],
      total: 1,
      page: 1,
      limit: 7,
      totalPages: 1,
    },
  })
  @ApiOperation({
    summary: 'Opciones de artículo y lista para selectores',
    description:
      'Sin login ni token. Datos de tbl_oitm relacionados con tbl_itm1 por empresa y artículo. Paginación 7/50.',
  })
  opciones(@Param() p: EmpresaCatalogoParams, @Query() q: ConsultaCatalogoDto) {
    return this.servicio.productos(p.empresaId, q, true);
  }

  @Get('empresas/:empresaId/productos')
  @ApiOperation({
    summary: 'Consultar productos y precios para la pantalla existente',
    description:
      'Público sin sesión. Adapta tbl_oitm (maestro oficial) y tbl_itm1 (precios) al contrato de la pantalla existente. Cada fila incluye su ID técnico como dato informativo; las operaciones usan ItemCode y PriceList; los campos generales son compartidos por todas las listas. Los nombres de listas se leen de tbl_opln. Nuevas integraciones: usar las rutas /tbl_oitm y /tbl_itm1 con los nombres originales de columnas. Paginación 7/50.',
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
    description: `Acepta un objeto o un arreglo de 1 a ${MAX_PRODUCTOS_POR_LOTE} objetos, dentro del límite HTTP configurado (50 MB por defecto). Permite el mismo itemcode en listas diferentes. Para un arreglo, omite las combinaciones (empresa, itemcode, pricelist) existentes y las repeticiones dentro del envío, sin modificar sus datos, e inserta las restantes. En repeticiones del arreglo prevalece la primera aparición. Devuelve un resumen con recibidos, insertados, existentes, duplicadosEnLote y omitidos, incluso si no se inserta ninguna fila (201). Valida todo antes de escribir: una fila inválida devuelve 400 sin insertar el lote; el 400 indica fila, campo, valor recibido y motivo (errores) y lista todas las filas con error en filasInvalidas (hasta 100). Otros errores de base de datos revierten la transacción completa. Para un objeto individual conserva la respuesta del producto y el conflicto 409 si ya existe.`,
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
    examples: {
      individual: {
        summary: 'Artículo y precio',
        value: {
          id: '1',
          itemcode: 'A0001',
          itemname: 'Artículo',
          iva: 10,
          itmsgrpcode: 100,
          itmsgrpnam: null,
          inventory: 'N',
          pricelist: 1,
          pricelistname: 'General',
          price: '15000.123456',
          tipo: null,
        },
      },
      lote: {
        summary: 'Resumen bulk',
        value: {
          recibidos: 3,
          insertados: 1,
          existentes: 1,
          duplicadosEnLote: 1,
          omitidos: 2,
        },
      },
    },
    schema: {
      oneOf: [
        { $ref: getSchemaPath(ProductoRespuestaDto) },
        { $ref: getSchemaPath(LoteProductosRespuestaDto) },
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

  @Put('empresas/:empresaId/productos/:ItemCode/:PriceList')
  @ApiOperation({
    summary: 'Editar un artículo de una lista por ItemCode y PriceList',
    description:
      'Sin sesión. ItemCode y PriceList originales de la ruta identifican exclusivamente el precio en la empresa, nunca el id técnico. Los códigos conservan ceros iniciales y deben codificarse en la URL. Para cambiar la clave enviar sus valores nuevos en el cuerpo. Actualiza el maestro tbl_oitm del código enviado y el precio de esta lista en una transacción. Los datos generales y el nombre de la lista son compartidos por otros artículos/listas. No puede duplicar la pareja ItemCode/PriceList en la empresa (409).',
  })
  @ApiOkResponse({ type: ProductoRespuestaDto })
  editar(@Param() p: ProductoCatalogoParams, @Body() d: DatosProductoDto) {
    return this.servicio.editarProducto(
      p.empresaId,
      p.ItemCode,
      p.PriceList,
      d,
    );
  }

  @Delete('empresas/:empresaId/productos/:ItemCode/:PriceList')
  @ApiOperation({
    summary: 'Eliminar el precio de una lista',
    description:
      'Sin sesión. Identifica por ItemCode y PriceList exactos dentro de la empresa, nunca por id técnico. Elimina solo la fila de tbl_itm1 de la empresa; conserva el artículo oficial de tbl_oitm y sus otros precios.',
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      required: ['ok'],
      properties: { ok: { type: 'boolean' } },
    },
    example: { ok: true },
  })
  eliminar(@Param() p: ProductoCatalogoParams) {
    return this.servicio.eliminarProducto(p.empresaId, p.ItemCode, p.PriceList);
  }
}
