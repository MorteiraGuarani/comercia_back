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
import type { LoteValidado } from '../common/interfaces/error-validacion.interface';
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
                  maxLength: t.nombre === 'tbl_oitm' ? 100 : 50,
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
  const ejemplo = {
    ...(t.nombre === 'tbl_oitm' ? {} : { id: '1' }),
    ...t.ejemplo,
  };
  const respuesta = {
    allOf: [
      { $ref: getSchemaPath(t.Dto) },
      {
        type: 'object' as const,
        required: [
          ...(t.nombre === 'tbl_oitm' ? [] : ['id']),
          ...Object.keys(t.columnas),
        ],
        properties: {
          ...(t.nombre === 'tbl_oitm'
            ? {}
            : {
                id: {
                  type: 'string' as const,
                  readOnly: true,
                  description:
                    'ID técnico interno, informativo. No se acepta como identificador en las rutas.',
                  example: '1',
                },
              }),
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
  const detalle = `${acceso} ${t.nombre === 'tbl_oitm' ? 'Maestro global: empresaId debe existir, pero todos los accesos comparten los mismos artículos. Las modificaciones afectan a todas las empresas. No tiene id técnico.' : 'Datos aislados por empresaId existente; id es técnico y solo informativo.'} Nombres de campos y mayúsculas exactos. Clave de negocio: ${t.clave.join(' + ')}. La ruta identifica la fila exclusivamente por esa clave. Los ceros iniciales se conservan. Para renombrar una clave, usar su valor original en la ruta y el nuevo en el cuerpo. Los decimales se devuelven como texto exacto de seis posiciones. ${t.nombre === 'tbl_itm1' ? 'Debe existir antes el artículo en tbl_oitm. El código del maestro solo admite 15 caracteres.' : ''} ${t.nombre === 'tbl_spp1' ? 'La estructura solicitada no incluye fechas de inicio/fin; no se calculan vigencias por fecha.' : ''} ${t.nombre === 'tbl_spp2' ? 'La clave no incluye ListNum ni líneas: solo una promoción por artículo y socio. SPP1Lnum es una referencia lógica que puede coincidir en varias listas; no se inventa una lista.' : ''}`;
  const rutas = [t.nombre, ...(t.alias ? [t.alias] : [])].map(
    (n) => 'admin/catalogo/empresas/:empresaId/' + n,
  );
  @Controller(rutas)
  @ApiParam({
    name: 'empresaId',
    type: Number,
    example: 1,
    description:
      t.nombre === 'tbl_oitm'
        ? 'Empresa existente; el maestro es global y compartido.'
        : 'Empresa existente; limita todas las operaciones.',
  })
  @ApiTags('Catálogo · ' + t.nombre + ' · ' + t.titulo)
  @ApiExtraModels(t.Dto, EdicionDto, ResumenLoteDto)
  @ApiBadRequestResponse({
    description:
      'Objeto, cuerpo, parámetros o paginación inválidos. message dice el campo, el valor recibido y el motivo; errores lista cada campo inválido ({ campo, valor, mensajes }). Un bulk bien formado no responde 400 por sus filas: las inválidas vuelven en filasInvalidas del resumen (201).',
  })
  @ApiNotFoundResponse({
    description: 'Empresa o registro no disponible en la empresa.',
  })
  @ApiConflictResponse({
    description:
      'Clave duplicada, artículo ausente o referencias que impiden la operación.',
  })
  @ApiResponse({ status: 429, description: 'Límite de solicitudes alcanzado.' })
  // Todas las tablas tbl_* son públicas por pedido del usuario; protegida vuelve a exigir JWT + superadmin.
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
        ` Acepta un objeto o un arreglo de 1 a ${MAX_PRODUCTOS_POR_LOTE} filas, hasta 50 MiB por defecto. En bulk, una fila con error no corta la carga: las filas inválidas (y en tbl_itm1 las de artículos que no existen en tbl_oitm) se saltean y vuelven en filasInvalidas con fila, campo, valor y motivo; se conserva la primera aparición de cada clave y se omiten las existentes sin actualizarlas; el resto se guarda. Un fallo inesperado de la base revierte el lote. Un objeto devuelve la fila, 400 si es inválido y 409 si ya existe; un arreglo devuelve siempre el resumen con 201, aunque no se guarde ninguna fila. null guarda NULL solo en columnas nullable; omitir un campo aplica su default al crear.`,
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
                recibidos: 4,
                insertados: 1,
                existentes: 1,
                duplicadosEnLote: 1,
                omitidos: 2,
                invalidas: 1,
                filasInvalidas: [
                  {
                    clave: { ItemCode: 'A0001' },
                    fila: 4,
                    errores: [
                      {
                        campo: 'SWeight1',
                        valor: '',
                        mensajes: [
                          'El decimal admite hasta 15 enteros y 6 decimales',
                        ],
                      },
                    ],
                    motivo:
                      'ItemCode A0001: SWeight1 = "": El decimal admite hasta 15 enteros y 6 decimales',
                  },
                ],
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
      @Body(new CargaTablaPipe(t.Dto, true, undefined, t.clave))
      d: Record<string, unknown> | LoteValidado,
    ) {
      return this.servicio.crear(t, p.empresaId, d, r.usuarioId);
    }
    @Put(rutaClave)
    @documentarClave()
    @ApiOperation({
      summary: 'Editar ' + t.nombre,
      description:
        detalle +
        ' Modifica los campos enviados y conserva los omitidos. null solo está permitido en campos nullable. Los cambios del maestro se reflejan en todas sus listas; para cambiar una clave con referencias existentes, primero se deben eliminar o reasignar esas referencias.',
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
