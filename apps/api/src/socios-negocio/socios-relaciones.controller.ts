import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiExtraModels,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ConsultaSociosDto } from './dto/consulta-socios.dto';
import { SocioParams } from './dto/socio-params.dto';
import { TABLAS_SOCIOS } from './tablas-socios';
import { SociosNegocioService } from './socios-negocio.service';
import {
  esquemaPaginaSocios,
  esquemaRespuestaSocios,
  ejemploRespuestaSocios,
} from './utils/swagger-socios';

@Controller('admin/socios-negocio/empresas/:empresaId/tbl_ocrd')
@ApiTags('Socios de negocio · tbl_ocrd')
@ApiExtraModels(...Object.values(TABLAS_SOCIOS).map((tabla) => tabla.Dto))
@ApiBadRequestResponse({ description: 'Identificador o paginación inválidos.' })
@ApiNotFoundResponse({
  description: 'Empresa o socio no disponible en la empresa de la ruta.',
})
// Consultas públicas expresamente solicitadas, con empresa e identificadores validados.
export class SociosRelacionesController {
  constructor(private readonly servicio: SociosNegocioService) {}
  @Get(':CardCode/relaciones')
  @ApiOperation({
    summary: 'Resolver los catálogos relacionados con el socio',
    description:
      'Público sin login ni token. El socio se identifica por CardCode exacto, nunca por id técnico. Todas las referencias se resuelven dentro de empresaId. GroupCode→tbl_ocrg; GroupNum→tbl_octg; ListNum→tbl_opln; AgentCode→tbl_oagp; SlpCode→tbl_oslp. U_jCANAL y U_jSUBCANAL conservan texto y, cuando representan un entero int4, se buscan en Code de tbl_jcanal/tbl_jsubcanal. Las tablas en plural son catálogos independientes, sin mezcla automática. Una referencia nula o todavía no cargada devuelve null; no se crean filas ficticias para -1. Las direcciones se consultan por separado con paginación.',
  })
  @ApiOkResponse({
    example: Object.fromEntries(
      [
        TABLAS_SOCIOS.tbl_ocrd,
        TABLAS_SOCIOS.tbl_ocrg,
        TABLAS_SOCIOS.tbl_octg,
        TABLAS_SOCIOS.tbl_opln,
        TABLAS_SOCIOS.tbl_oagp,
        TABLAS_SOCIOS.tbl_oslp,
        TABLAS_SOCIOS.tbl_jcanal,
        TABLAS_SOCIOS.tbl_jsubcanal,
      ].map((tabla) => [tabla.nombre, ejemploRespuestaSocios(tabla)]),
    ),
    schema: {
      type: 'object',
      required: [
        'tbl_ocrd',
        'tbl_ocrg',
        'tbl_octg',
        'tbl_opln',
        'tbl_oagp',
        'tbl_oslp',
        'tbl_jcanal',
        'tbl_jsubcanal',
      ],
      properties: Object.fromEntries(
        [
          TABLAS_SOCIOS.tbl_ocrd,
          TABLAS_SOCIOS.tbl_ocrg,
          TABLAS_SOCIOS.tbl_octg,
          TABLAS_SOCIOS.tbl_opln,
          TABLAS_SOCIOS.tbl_oagp,
          TABLAS_SOCIOS.tbl_oslp,
          TABLAS_SOCIOS.tbl_jcanal,
          TABLAS_SOCIOS.tbl_jsubcanal,
        ].map((tabla) => [
          tabla.nombre,
          {
            ...esquemaRespuestaSocios(tabla),
            ...(tabla.nombre === 'tbl_ocrd' ? {} : { nullable: true }),
          },
        ]),
      ),
    },
  })
  relaciones(@Param() p: SocioParams) {
    return this.servicio.relaciones(p.empresaId, p.CardCode);
  }

  @Get(':CardCode/direcciones')
  @ApiOperation({
    summary: 'Listar tbl_crd1 del socio, por CardCode',
    description:
      'Público sin login ni token. La ruta usa CardCode exacto del socio, nunca el id técnico. Devuelve exclusivamente las direcciones con el mismo CardCode y empresa del socio. Acepta buscar, page y limit (7 por defecto, máximo 50).',
  })
  @ApiOkResponse({
    schema: esquemaPaginaSocios(TABLAS_SOCIOS.tbl_crd1),
    example: {
      items: [ejemploRespuestaSocios(TABLAS_SOCIOS.tbl_crd1)],
      total: 1,
      page: 1,
      limit: 7,
      totalPages: 1,
    },
  })
  direcciones(@Param() p: SocioParams, @Query() q: ConsultaSociosDto) {
    return this.servicio.direcciones(p.empresaId, p.CardCode, q);
  }
}
