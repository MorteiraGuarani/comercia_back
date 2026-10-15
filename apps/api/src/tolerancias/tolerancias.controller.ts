import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { RequestConUsuario } from '../auth/interfaces/request-con-usuario.interface';
import { ToleranciasService } from './tolerancias.service';
import { ToleranciaHorarioDto } from './dto/tolerancia-horario.dto';
import { ConsultaToleranciaDto } from './dto/consulta-tolerancia.dto';

@ApiTags('Tolerancias de horario')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Sesión requerida' })
@ApiForbiddenResponse({ description: 'Sin permisos para el ámbito o empresa' })
@ApiNotFoundResponse({ description: 'Recurso no disponible' })
@ApiBadRequestResponse({
  description: 'Minutos, identificadores o límites inválidos',
})
@ApiParam({
  name: 'alcance',
  enum: ['global', 'empresa', 'horario', 'usuario'],
})
@ApiParam({
  name: 'id',
  type: Number,
  description:
    '0 para global; identificador del recurso para los demás ámbitos. horario identifica la franja de campo.',
})
@ApiQuery({
  name: 'empresaId',
  type: Number,
  required: false,
  description:
    'Empresa seleccionada para administrar usuarios o planes como superadmin.',
})
@Controller('campo/tolerancias')
@UseGuards(JwtAuthGuard)
export class ToleranciasController {
  constructor(private readonly servicio: ToleranciasService) {}
  @Get(':alcance/:id')
  @ApiOperation({
    summary: 'Consultar tolerancias propias y heredadas',
    description:
      'Prioridad por campo: usuario > horario > empresa > global > valores iniciales. No modifica registros históricos.',
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      required: ['alcance', 'id', 'valores', 'heredados', 'efectivos'],
      properties: {
        alcance: { type: 'string' },
        id: { type: 'integer' },
        valores: { $ref: '#/components/schemas/ToleranciaHorarioDto' },
        heredados: { $ref: '#/components/schemas/ToleranciaHorarioDto' },
        efectivos: { $ref: '#/components/schemas/ToleranciaHorarioDto' },
      },
    },
  })
  consultar(
    @Req() r: RequestConUsuario,
    @Param('alcance') alcance: string,
    @Param('id', ParseIntPipe) id: number,
    @Query() q: ConsultaToleranciaDto,
  ) {
    return this.servicio.consultar(r.usuarioId, alcance, id, q.empresaId);
  }
  @Put(':alcance/:id')
  @ApiOperation({
    summary: 'Configurar tolerancias del ámbito',
    description:
      'Reemplaza valores propios en minutos (0..1440). null u omitido hereda. Solo superadmin cambia global y empresa. No bloquea marcaciones ni modifica sus horas reales. Los cambios afectan nuevas entradas.',
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        alcance: { type: 'string' },
        id: { type: 'integer' },
        valores: { $ref: '#/components/schemas/ToleranciaHorarioDto' },
        heredados: { $ref: '#/components/schemas/ToleranciaHorarioDto' },
        efectivos: { $ref: '#/components/schemas/ToleranciaHorarioDto' },
      },
    },
  })
  guardar(
    @Req() r: RequestConUsuario,
    @Param('alcance') alcance: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ToleranciaHorarioDto,
    @Query() q: ConsultaToleranciaDto,
  ) {
    return this.servicio.guardar(r.usuarioId, alcance, id, dto, q.empresaId);
  }
}
