import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Put,
  Query,
  ValidationPipe,
  applyDecorators,
} from '@nestjs/common';
import type { Type } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
  getSchemaPath,
  PartialType,
} from '@nestjs/swagger';
import {
  CodigoCatalogoParams,
  DireccionParams,
  SelectorDireccionDto,
  ConsultaDireccionesDto,
  SinConsultaDto,
} from './dto/registro-params.dto';
import type { ConsultaDireccion } from './interfaces/consulta-direccion.interface';
import { SocioParams } from './dto/socio-params.dto';
import { ResumenLoteDto } from '../common/dto/resumen-lote.dto';
import {
  ConsultaSociosDto,
  EmpresaSociosParams,
  RegistroSociosParams,
} from './dto/consulta-socios.dto';
import type { TablaSociosDefinicion } from './interfaces/tabla-socios.interface';
import type { EntradaSocio } from './interfaces/registro-socio.interface';
import type { LoteValidado } from '../common/interfaces/error-validacion.interface';
import { CrearSociosPipe } from './pipes/crear-socios.pipe';
import { SociosNegocioService } from './socios-negocio.service';
import { MAX_SOCIOS_POR_LOTE } from './tablas-socios';
import {
  esquemaPaginaSocios,
  esquemaRespuestaSocios,
  ejemploRespuestaSocios,
  ejemplosSolicitudSocios,
} from './utils/swagger-socios';

export function crearControladorSocios(
  tabla: TablaSociosDefinicion,
): Type<object> {
  const esSocio = tabla.nombre === 'tbl_ocrd';
  const esDireccion = tabla.nombre === 'tbl_crd1';
  const esCodigo =
    tabla.nombre === 'tbl_jcanales' || tabla.nombre === 'tbl_jsubcanales';
  const ruta =
    esSocio || esDireccion ? ':CardCode' : esCodigo ? ':Code' : ':id';
  const Parametros = esSocio
    ? SocioParams
    : esDireccion
      ? DireccionParams
      : esCodigo
        ? CodigoCatalogoParams
        : RegistroSociosParams;
  const consulta = (listado: boolean) =>
    new ValidationPipe({
      expectedType: esDireccion
        ? listado
          ? ConsultaDireccionesDto
          : SelectorDireccionDto
        : SinConsultaDto,
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    });
  const documentarDireccion = (listado = false) =>
    applyDecorators(
      ...(esDireccion
        ? [
            ApiQuery({
              name: 'direccion',
              required: false,
              type: String,
              example: JSON.stringify({
                Address: 'Sucursal de ejemplo',
                Street: 'Calle de ejemplo 123',
                AdresType: 'S',
              }),
              description:
                'Selector JSON opcional con Address, Street y AdresType originales, incluyendo null donde corresponda. Usar encodeURIComponent. En PUT/DELETE identifica una sola dirección; sin selector se opera solo si CardCode tiene exactamente una fila, en otro caso 409 sin cambios. No acepta id técnico.',
            }),
            ...(listado
              ? [
                  ApiQuery({
                    name: 'page',
                    required: false,
                    schema: { type: 'integer', minimum: 1, default: 1 },
                  }),
                  ApiQuery({
                    name: 'limit',
                    required: false,
                    schema: {
                      type: 'integer',
                      minimum: 1,
                      maximum: 50,
                      default: 7,
                    },
                  }),
                  ApiQuery({ name: 'buscar', required: false, type: String }),
                ]
              : []),
          ]
        : []),
    );
  const identidad =
    esSocio || esDireccion ? 'CardCode' : esCodigo ? 'Code' : 'id';
  const detalleClave =
    esSocio || esDireccion || esCodigo
      ? `La ruta usa ${identidad} original y empresaId, sin búsqueda alternativa por id técnico. Codificar caracteres especiales en la URL. Si cambia la clave, enviar la nueva en el cuerpo y conservar la original en la ruta.`
      : 'id es el identificador técnico de esta fila de catálogo.';

  const validar = new ValidationPipe({
    expectedType: Parametros,
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  const codigo = (
    p:
      | SocioParams
      | RegistroSociosParams
      | CodigoCatalogoParams
      | DireccionParams,
  ) => ('CardCode' in p ? p.CardCode : 'Code' in p ? p.Code : p.id);
  const documentarCodigo = () =>
    ApiParam({
      name: identidad,
      schema:
        esSocio || esDireccion
          ? { type: 'string', minLength: 1, maxLength: esDireccion ? 200 : 50 }
          : esCodigo
            ? { type: 'integer', minimum: -2147483648, maximum: 2147483647 }
            : { type: 'string', pattern: '^[1-9][0-9]{0,18}$', maxLength: 19 },
      example: esSocio || esDireccion ? 'C00001' : esCodigo ? 1 : '1',
      description: detalleClave,
    });
  const respuesta = esquemaRespuestaSocios(tabla);
  const ejemplo = ejemploRespuestaSocios(tabla);
  const EdicionDto = PartialType(tabla.Dto, { skipNullProperties: false });
  Object.defineProperty(EdicionDto, 'name', {
    value: `Editar${tabla.Dto.name}`,
  });
  const acceso =
    'Público por solicitud explícita del usuario: no requiere login, cookie, token ni API key. empresaId debe existir y limita todas las operaciones. Los nombres de campos distinguen mayúsculas/minúsculas.';
  const errores = {
    type: 'object' as const,
    properties: {
      statusCode: { type: 'integer' as const },
      message: {
        oneOf: [
          { type: 'string' as const },
          { type: 'array' as const, items: { type: 'string' as const } },
        ],
      },
      index: {
        type: 'integer' as const,
        minimum: 0,
        description:
          'Índice de la primera fila inválida en bulk, comenzando en cero.',
      },
      errores: {
        type: 'array' as const,
        description: 'Cada campo inválido: nombre, valor recibido y motivos.',
        items: {
          type: 'object' as const,
          properties: {
            campo: { type: 'string' as const, example: 'GroupCode' },
            valor: { example: 32768 },
            mensajes: {
              type: 'array' as const,
              items: { type: 'string' as const },
              example: ['GroupCode must not be greater than 32767'],
            },
          },
        },
      },
      filasInvalidas: {
        type: 'array' as const,
        description:
          'Bulk: filas salteadas por error (hasta 1000), en el resumen 201; el resto se guarda.',
        items: {
          type: 'object' as const,
          properties: {
            index: { type: 'integer' as const, minimum: 0 },
            fila: { type: 'integer' as const, minimum: 1 },
            errores: {
              type: 'array' as const,
              items: { type: 'object' as const },
            },
            motivo: { type: 'string' as const },
          },
        },
      },
      details: {
        type: 'object' as const,
        additionalProperties: true,
        description: 'Detalle de validación de la fila.',
      },
      limitBytes: {
        type: 'integer' as const,
        description: 'Límite HTTP en bytes, si se excedió el tamaño permitido.',
      },
    },
  };

  @Controller(`admin/socios-negocio/empresas/:empresaId/${tabla.nombre}`)
  @ApiParam({ name: 'empresaId', type: Number, example: 1 })
  @ApiTags(`Socios de negocio · ${tabla.nombre}`)
  @ApiExtraModels(tabla.Dto, EdicionDto, ResumenLoteDto)
  @ApiBadRequestResponse({
    description:
      'Datos, identificadores o paginación inválidos; el lote indica index y la fila que falló.',
    schema: errores,
  })
  @ApiNotFoundResponse({
    description: 'Empresa o fila no disponible en la empresa de la ruta.',
    schema: errores,
  })
  @ApiConflictResponse({
    description:
      'Clave ya existente o registro relacionado que debe reasignarse primero.',
    schema: errores,
  })
  @ApiResponse({
    status: 429,
    description: 'Límite de solicitudes alcanzado; reintentar más tarde.',
    schema: errores,
  })
  // Excepción pública expresa para las nueve tablas de socios de negocio.
  class ControladorTablaSocios {
    constructor(
      @Inject(SociosNegocioService) readonly servicio: SociosNegocioService,
    ) {}

    @Get()
    @ApiOperation({
      summary: `Listar ${tabla.nombre} · ${tabla.titulo}`,
      description: `${acceso} Búsqueda en ${tabla.busqueda.join(', ')}. Página predeterminada: 7 filas; máximo: 50. Para encontrar empresaId puede usarse GET /api/v1/admin/catalogo/empresas.`,
    })
    @ApiOkResponse({
      schema: esquemaPaginaSocios(tabla),
      example: { items: [ejemplo], total: 1, page: 1, limit: 7, totalPages: 1 },
    })
    listar(@Param() p: EmpresaSociosParams, @Query() q: ConsultaSociosDto) {
      return this.servicio.listar(tabla, p.empresaId, q);
    }

    @Get(ruta)
    @documentarCodigo()
    @ApiOperation({
      summary: esDireccion
        ? 'Listar direcciones por CardCode'
        : `Consultar una fila de ${tabla.nombre} por ${identidad}`,
      description: `${acceso} ${detalleClave} ${esDireccion ? 'Devuelve todas las direcciones de ese CardCode con paginación 7/50; direccion permite filtrar una clave de dirección completa.' : ''}`,
    })
    @documentarDireccion(true)
    @ApiOkResponse({
      schema: esDireccion ? esquemaPaginaSocios(tabla) : respuesta,
      example: esDireccion
        ? { items: [ejemplo], total: 1, page: 1, limit: 7, totalPages: 1 }
        : ejemplo,
    })
    obtener(
      @Param(validar)
      p:
        | SocioParams
        | RegistroSociosParams
        | CodigoCatalogoParams
        | DireccionParams,
      @Query(consulta(true)) q: ConsultaDireccion,
    ) {
      return this.servicio.obtener(tabla, p.empresaId, codigo(p), q);
    }

    @Post()
    @ApiOperation({
      summary: `Cargar ${tabla.nombre}: individual o bulk`,
      description: `${acceso} Acepta un objeto o un arreglo de 1 a ${MAX_SOCIOS_POR_LOTE} filas, hasta el límite HTTP de carga masiva (50 MiB por defecto). Clave de duplicado dentro de la empresa: ${tabla.clave.join(' + ')}; null y los valores predeterminados omitidos se comparan de forma consistente. En bulk se conserva la primera aparición y se omiten las claves existentes, sin actualizarlas. Una fila con error no corta la carga: se saltea y vuelve en filasInvalidas con fila, campo, valor y motivo, y el resto se guarda; un fallo inesperado de la base revierte el lote. Un objeto devuelve la fila, 400 si es inválido y 409 si ya existe. Un arreglo devuelve siempre el resumen con 201, aunque no se guarde ninguna fila. ${tabla.identidad ? 'Si falta Code se asigna uno nuevo por empresa; filas sin Code son nuevas filas, no se deduplican por Name.' : ''} Las referencias lógicas pueden cargarse en cualquier orden; no se inventan registros para -1 o códigos todavía ausentes.`,
    })
    @ApiBody({
      schema: {
        oneOf: [
          { $ref: getSchemaPath(tabla.Dto) },
          {
            type: 'array',
            minItems: 1,
            maxItems: MAX_SOCIOS_POR_LOTE,
            items: { $ref: getSchemaPath(tabla.Dto) },
          },
        ],
      },
      examples: ejemplosSolicitudSocios(tabla),
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
                    clave: { CardCode: 'C0001' },
                    fila: 4,
                    errores: [
                      {
                        campo: 'GroupCode',
                        valor: 32768,
                        mensajes: ['GroupCode must not be greater than 32767'],
                      },
                    ],
                    motivo:
                      'CardCode C0001: GroupCode = 32768: GroupCode must not be greater than 32767',
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
      description: 'El JSON supera el límite HTTP de carga masiva configurado.',
      schema: errores,
    })
    crear(
      @Param() p: EmpresaSociosParams,
      @Body(new CrearSociosPipe(tabla.Dto, true, tabla.clave))
      d: EntradaSocio | LoteValidado,
    ) {
      return this.servicio.crear(tabla, p.empresaId, d);
    }

    @Put(ruta)
    @documentarDireccion()
    @documentarCodigo()
    @ApiOperation({
      summary: `Editar una fila de ${tabla.nombre}`,
      description: `${acceso} ${detalleClave} Actualiza los campos enviados y conserva los omitidos; null vacía un campo nullable. Usa los mismos nombres y restricciones de creación. id y empresa_id no se aceptan en el cuerpo. No permite duplicar la clave ni cambiar un código mientras tenga referencias.`,
    })
    @ApiBody({
      type: EdicionDto,
      examples: {
        edicion: {
          summary: 'Campos de negocio de la fila',
          value: tabla.ejemplo,
        },
      },
    })
    @ApiOkResponse({ schema: respuesta, example: ejemplo })
    editar(
      @Param(validar)
      p:
        | SocioParams
        | RegistroSociosParams
        | CodigoCatalogoParams
        | DireccionParams,
      @Body(new CrearSociosPipe(EdicionDto, false)) d: EntradaSocio,
      @Query(consulta(false)) q: ConsultaDireccion,
    ) {
      return this.servicio.editar(
        tabla,
        p.empresaId,
        codigo(p),
        d,
        q.direccion,
      );
    }

    @Delete(ruta)
    @documentarDireccion()
    @documentarCodigo()
    @ApiOperation({
      summary: `Eliminar una fila de ${tabla.nombre}`,
      description: `${acceso} ${detalleClave} Elimina únicamente la fila de esa empresa. Un socio con direcciones o un catálogo canónico usado por socios devuelve 409; quitar o reasignar sus referencias antes de eliminar.`,
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
      @Param(validar)
      p:
        | SocioParams
        | RegistroSociosParams
        | CodigoCatalogoParams
        | DireccionParams,
      @Query(consulta(false)) q: ConsultaDireccion,
    ) {
      return this.servicio.eliminar(tabla, p.empresaId, codigo(p), q.direccion);
    }
  }
  Object.defineProperty(ControladorTablaSocios, 'name', {
    value: `Socios_${tabla.nombre}_Controller`,
  });
  return ControladorTablaSocios;
}
