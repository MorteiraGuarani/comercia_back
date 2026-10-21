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
  ApiResponse,
  ApiTags,
  getSchemaPath,
  PartialType,
} from '@nestjs/swagger';
import { SocioParams } from './dto/socio-params.dto';
import { ResumenLoteDto } from '../common/dto/resumen-lote.dto';
import {
  ConsultaSociosDto,
  EmpresaSociosParams,
  RegistroSociosParams,
} from './dto/consulta-socios.dto';
import type { TablaSociosDefinicion } from './interfaces/tabla-socios.interface';
import type { EntradaSocio } from './interfaces/registro-socio.interface';
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
  const ruta = esSocio ? ':CardCode' : ':id';
  const Parametros = esSocio ? SocioParams : RegistroSociosParams;
  const validar = new ValidationPipe({
    expectedType: Parametros,
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  const codigo = (p: SocioParams | RegistroSociosParams) =>
    'CardCode' in p ? p.CardCode : p.id;
  const documentarCodigo = () =>
    ApiParam({
      name: esSocio ? 'CardCode' : 'id',
      schema: esSocio
        ? { type: 'string', minLength: 1, maxLength: 15 }
        : { type: 'string', pattern: '^[1-9][0-9]{0,18}$', maxLength: 19 },
      example: esSocio ? 'C00001' : '1',
      description: esSocio
        ? 'CardCode original exacto del socio en esta empresa; conserva ceros iniciales. Codificar caracteres especiales en la URL. Nunca se interpreta como id técnico.'
        : 'ID técnico de la fila de catálogo o dirección.',
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
        description: 'Índice de la fila inválida en bulk, comenzando en cero.',
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
  // Excepción pública expresa para las once tablas de socios de negocio.
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
      summary: `Consultar una fila de ${tabla.nombre}`,
      description: `${acceso} ${esSocio ? 'La ruta usa exclusivamente CardCode, nunca el id técnico de PostgreSQL. Usar el código original en la ruta si se cambia CardCode en el cuerpo; codificar caracteres especiales en la URL.' : 'id es el identificador técnico de esta fila de catálogo o dirección.'}`,
    })
    @ApiOkResponse({ schema: respuesta, example: ejemplo })
    obtener(@Param(validar) p: SocioParams | RegistroSociosParams) {
      return this.servicio.obtener(tabla, p.empresaId, codigo(p));
    }

    @Post()
    @ApiOperation({
      summary: `Cargar ${tabla.nombre}: individual o bulk`,
      description: `${acceso} Acepta un objeto o un arreglo de 1 a ${MAX_SOCIOS_POR_LOTE} filas, hasta el límite HTTP de carga masiva (50 MiB por defecto). Clave de duplicado dentro de la empresa: ${tabla.clave.join(' + ')}; null y los valores predeterminados omitidos se comparan de forma consistente. En bulk se conserva la primera aparición y se omiten las claves existentes, sin actualizarlas. Una fila inválida devuelve 400 antes de escribir; cualquier otro fallo revierte la transacción completa. Un objeto devuelve la fila y responde 409 si ya existe. Un arreglo devuelve el resumen con 201 incluso si todo se omite. ${tabla.identidad ? 'Si falta Code se asigna uno nuevo por empresa; filas sin Code son nuevas filas, no se deduplican por Name.' : ''} Las referencias lógicas pueden cargarse en cualquier orden; no se inventan registros para -1 o códigos todavía ausentes.`,
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
      description: 'El JSON supera el límite HTTP de carga masiva configurado.',
      schema: errores,
    })
    crear(
      @Param() p: EmpresaSociosParams,
      @Body(new CrearSociosPipe(tabla.Dto)) d: EntradaSocio | EntradaSocio[],
    ) {
      return this.servicio.crear(tabla, p.empresaId, d);
    }

    @Put(ruta)
    @documentarCodigo()
    @ApiOperation({
      summary: `Editar una fila de ${tabla.nombre}`,
      description: `${acceso} ${esSocio ? 'Identifica el socio por CardCode original y empresaId, sin alternativa por id técnico.' : ''} Actualiza los campos enviados y conserva los omitidos; null vacía un campo nullable. Usa los mismos nombres y restricciones de creación. id y empresa_id no se aceptan en el cuerpo. No permite duplicar la clave ni cambiar un código mientras tenga referencias.`,
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
      @Param(validar) p: SocioParams | RegistroSociosParams,
      @Body(new CrearSociosPipe(EdicionDto, false)) d: EntradaSocio,
    ) {
      return this.servicio.editar(tabla, p.empresaId, codigo(p), d);
    }

    @Delete(ruta)
    @documentarCodigo()
    @ApiOperation({
      summary: `Eliminar una fila de ${tabla.nombre}`,
      description: `${acceso} ${esSocio ? 'Identifica el socio por CardCode exacto y empresaId, sin alternativa por id técnico.' : ''} Elimina únicamente la fila de esa empresa. Un socio con direcciones o un catálogo canónico usado por socios devuelve 409; quitar o reasignar sus referencias antes de eliminar.`,
    })
    @ApiOkResponse({
      schema: {
        type: 'object',
        required: ['ok'],
        properties: { ok: { type: 'boolean' } },
      },
      example: { ok: true },
    })
    eliminar(@Param(validar) p: SocioParams | RegistroSociosParams) {
      return this.servicio.eliminar(tabla, p.empresaId, codigo(p));
    }
  }
  Object.defineProperty(ControladorTablaSocios, 'name', {
    value: `Socios_${tabla.nombre}_Controller`,
  });
  return ControladorTablaSocios;
}
