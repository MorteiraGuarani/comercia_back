import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
  ValidationPipe,
  applyDecorators,
} from '@nestjs/common';
import type { Type } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  PartialType,
  getSchemaPath,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SuperadminGuard } from '../auth/superadmin.guard';
import type { RequestConUsuario } from '../auth/interfaces/request-con-usuario.interface';
import { EmpresaSociosParams } from '../socios-negocio/dto/consulta-socios.dto';
import { CargaTablaPipe } from '../common/pipes/carga-tabla.pipe';
import { ResumenLoteDto } from '../common/dto/resumen-lote.dto';
import type { TablaProductos } from './interfaces/tabla-productos.interface';
import { ConsultaTablasDto } from './dto/consulta-tablas.dto';
import { TablasProductosService } from './tablas-productos.service';
import { parametrosClave } from './utils/parametros-clave';
import type { ClaveProductoParams } from './interfaces/clave-producto.interface';
import { MAX_PRODUCTOS_POR_LOTE } from './productos.constants';

export function crearControladorTablaProductos(
  t: TablaProductos,
): Type<object> {
  const ClaveDto = parametrosClave(t);
  const validarClave = new ValidationPipe({
    expectedType: ClaveDto,
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  const rutaClave = t.clave.map((c) => ':' + c).join('/');
  const documentarClave = () =>
    applyDecorators(
      ...t.clave.map((c) =>
        ApiParam({
          name: c,
          required: true,
          schema:
            typeof t.ejemplo[c] === 'number'
              ? { type: 'integer', minimum: -2147483648, maximum: 2147483647 }
              : {
                  type: 'string',
                  minLength: 1,
                  maxLength: t.nombre === 'tbl_oitm' ? 15 : 50,
                },
          example: t.ejemplo[c],
          description:
            c +
            ' original de la fila dentro de la empresa. Los códigos son texto exacto, incluso si contienen solo dígitos. Codificar caracteres especiales en la URL.',
        }),
      ),
    );
  const EdicionDto = PartialType(t.Dto, { skipNullProperties: false });
  Object.defineProperty(EdicionDto, 'name', { value: 'Editar' + t.Dto.name });
  const ejemplo = { id: '1', ...t.ejemplo };
  const respuesta = {
    allOf: [
      { $ref: getSchemaPath(t.Dto) },
      {
        type: 'object' as const,
        required: ['id', ...Object.keys(t.columnas)],
        properties: {
          id: {
            type: 'string' as const,
            readOnly: true,
            description:
              'ID técnico interno, informativo. No se acepta como identificador en las rutas.',
            example: '1',
          },
          ...Object.fromEntries(
            t.decimales.map((c) => [
              c,
              {
                type: 'string',
                nullable: true,
                example: t.ejemplo[c],
                description: 'Decimal exacto con seis posiciones.',
              },
            ]),
          ),
        },
      },
    ],
  };
  const pagina = {
    type: 'object' as const,
    required: ['items', 'total', 'page', 'limit', 'totalPages'],
    properties: {
      items: { type: 'array' as const, items: respuesta },
      total: { type: 'integer' as const },
      page: { type: 'integer' as const },
      limit: { type: 'integer' as const },
      totalPages: { type: 'integer' as const },
    },
  };
  const segundo = { ...t.ejemplo };
  const key = t.clave.at(-1)!;
  segundo[key] =
    typeof segundo[key] === 'number'
      ? Number(segundo[key]) + 1
      : String(segundo[key]) + '-2';
  const acceso = t.protegida
    ? 'Requiere sesión JWT o cookie y superadministrador activo.'
    : 'Público sin login, cookie, token ni API key por solicitud expresa del usuario.';
  const detalle = `${acceso} Datos aislados por empresaId existente. Nombres de campos y mayúsculas exactos. Clave de negocio en la empresa: ${t.clave.join(' + ')}. La ruta identifica la fila exclusivamente por esa clave de negocio; no admite id técnico ni busca por él como alternativa. Los ceros iniciales se conservan. Para renombrar una clave, usar su valor original en la ruta y el nuevo en el cuerpo. id es técnico y solo informativo. Los decimales se devuelven como texto exacto de seis posiciones. ${t.nombre === 'tbl_itm1' ? 'Debe existir antes el artículo en tbl_oitm. El código del maestro solo admite 15 caracteres.' : ''} ${t.nombre === 'tbl_spp1' ? 'La estructura solicitada no incluye fechas de inicio/fin; no se calculan vigencias por fecha.' : ''} ${t.nombre === 'tbl_spp2' ? 'La clave no incluye ListNum ni líneas: solo una promoción por artículo y socio. SPP1Lnum es una referencia lógica que puede coincidir en varias listas; no se inventa una lista.' : ''}`;
  const rutas = [t.nombre, ...(t.alias ? [t.alias] : [])].map(
    (n) => 'admin/catalogo/empresas/:empresaId/' + n,
  );
  @Controller(rutas)
  @ApiParam({
    name: 'empresaId',
    type: Number,
    example: 1,
    description: 'Empresa existente; limita todas las operaciones.',
  })
  @ApiTags('Catálogo · ' + t.nombre + ' · ' + t.titulo)
  @ApiExtraModels(t.Dto, EdicionDto, ResumenLoteDto)
  @ApiBadRequestResponse({
    description:
      'Datos, parámetros o paginación inválidos. En bulk, index identifica la fila desde cero y details detalla la validación.',
  })
  @ApiNotFoundResponse({
    description: 'Empresa o registro no disponible en la empresa.',
  })
  @ApiConflictResponse({
    description:
      'Clave duplicada, artículo ausente o referencias que impiden la operación.',
  })
  @ApiResponse({ status: 429, description: 'Límite de solicitudes alcanzado.' })
  // Solo tbl_oitm/tbl_itm1 son públicos. Los precios especiales conservan sus guards.
  class TablaProductosController {
    constructor(
      @Inject(TablasProductosService) readonly servicio: TablasProductosService,
    ) {}
    @Get()
    @ApiOperation({
      summary: 'Listar ' + t.nombre,
      description:
        detalle +
        ' Paginado: 7 por defecto, máximo 50. buscar filtra texto; los filtros exactos aplican a las columnas presentes en la tabla.',
    })
    @ApiOkResponse({
      schema: pagina,
      example: { items: [ejemplo], total: 1, page: 1, limit: 7, totalPages: 1 },
    })
    listar(
      @Req() r: RequestConUsuario,
      @Param() p: EmpresaSociosParams,
      @Query() q: ConsultaTablasDto,
    ) {
      return this.servicio.listar(t, p.empresaId, q, r.usuarioId);
    }
    @Get(rutaClave)
    @documentarClave()
    @ApiOperation({
      summary: 'Consultar ' + t.nombre + ' por ' + t.clave.join(' + '),
      description: detalle,
    })
    @ApiOkResponse({ schema: respuesta, example: ejemplo })
    obtener(
      @Req() r: RequestConUsuario,
      @Param(validarClave) p: ClaveProductoParams,
    ) {
      return this.servicio.obtener(t, p.empresaId, p, r.usuarioId);
    }
    @Post()
    @ApiOperation({
      summary: 'Cargar ' + t.nombre + ': individual o bulk',
      description:
        detalle +
        ` Acepta un objeto o un arreglo de 1 a ${MAX_PRODUCTOS_POR_LOTE} filas, hasta 50 MiB por defecto. Se valida todo antes de escribir. En bulk se conserva la primera aparición de cada clave y se omiten las existentes sin actualizarlas. Un fallo real revierte toda la transacción. Un objeto devuelve la fila y 409 si ya existe; un arreglo devuelve el resumen con 201 incluso si todo se omite. null guarda NULL solo en columnas nullable; omitir un campo aplica su default al crear.`,
    })
    @ApiBody({
      schema: {
        oneOf: [
          { $ref: getSchemaPath(t.Dto) },
          {
            type: 'array',
            minItems: 1,
            maxItems: MAX_PRODUCTOS_POR_LOTE,
            items: { $ref: getSchemaPath(t.Dto) },
          },
        ],
      },
      examples: {
        individual: { value: t.ejemplo },
        lote: { value: [t.ejemplo, segundo] },
      },
    })
    @ApiCreatedResponse({
      content: {
        'application/json': {
          schema: {
            oneOf: [respuesta, { $ref: getSchemaPath(ResumenLoteDto) }],
          },
          examples: {
            individual: { value: ejemplo },
            lote: {
              value: {
                recibidos: 3,
                insertados: 1,
                existentes: 1,
                duplicadosEnLote: 1,
                omitidos: 2,
              },
            },
          },
        },
      },
    })
    @ApiResponse({
      status: 413,
      description: 'El JSON supera el límite HTTP configurado.',
    })
    crear(
      @Req() r: RequestConUsuario,
      @Param() p: EmpresaSociosParams,
      @Body(new CargaTablaPipe(t.Dto))
      d: Record<string, unknown> | Record<string, unknown>[],
    ) {
      return this.servicio.crear(t, p.empresaId, d, r.usuarioId);
    }
    @Put(rutaClave)
    @documentarClave()
    @ApiOperation({
      summary: 'Editar ' + t.nombre,
      description:
        detalle +
        ' Modifica los campos enviados y conserva los omitidos. null solo está permitido en campos nullable. Los cambios del maestro se reflejan en todas sus listas; cambiar su ItemCode actualiza tbl_itm1 mediante FK. Las referencias especiales usadas deben reasignarse primero.',
    })
    @ApiBody({ type: EdicionDto, examples: { edicion: { value: t.ejemplo } } })
    @ApiOkResponse({ schema: respuesta, example: ejemplo })
    editar(
      @Req() r: RequestConUsuario,
      @Param(validarClave) p: ClaveProductoParams,
      @Body(new CargaTablaPipe(EdicionDto, false)) d: Record<string, unknown>,
    ) {
      return this.servicio.editar(t, p.empresaId, p, d, r.usuarioId);
    }
    @Patch(rutaClave)
    @documentarClave()
    @ApiOperation({
      summary: 'Editar parcialmente ' + t.nombre,
      description:
        detalle + ' Equivalente a PUT parcial: conserva los campos omitidos.',
    })
    @ApiBody({ type: EdicionDto, examples: { edicion: { value: t.ejemplo } } })
    @ApiOkResponse({ schema: respuesta, example: ejemplo })
    parcial(
      @Req() r: RequestConUsuario,
      @Param(validarClave) p: ClaveProductoParams,
      @Body(new CargaTablaPipe(EdicionDto, false)) d: Record<string, unknown>,
    ) {
      return this.servicio.editar(t, p.empresaId, p, d, r.usuarioId);
    }
    @Delete(rutaClave)
    @documentarClave()
    @ApiOperation({
      summary: 'Eliminar ' + t.nombre,
      description:
        detalle +
        ' Devuelve 409 si existen precios o referencias que deben eliminarse o reasignarse primero.',
    })
    @ApiOkResponse({
      schema: {
        type: 'object',
        required: ['ok'],
        properties: { ok: { type: 'boolean' } },
      },
      example: { ok: true },
    })
    eliminar(
      @Req() r: RequestConUsuario,
      @Param(validarClave) p: ClaveProductoParams,
    ) {
      return this.servicio.eliminar(t, p.empresaId, p, r.usuarioId);
    }
  }
  Object.defineProperty(TablaProductosController, 'name', {
    value: 'Catalogo_' + t.nombre + '_Controller',
  });
  if (t.protegida) {
    UseGuards(JwtAuthGuard, SuperadminGuard)(TablaProductosController);
    ApiBearerAuth()(TablaProductosController);
    ApiCookieAuth()(TablaProductosController);
    ApiUnauthorizedResponse({ description: 'Sesión requerida.' })(
      TablaProductosController,
    );
    ApiForbiddenResponse({
      description: 'Requiere superadministrador activo.',
    })(TablaProductosController);
  }
  return TablaProductosController;
}
