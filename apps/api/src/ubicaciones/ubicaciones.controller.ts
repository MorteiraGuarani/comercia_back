import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiPayloadTooLargeResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { RequestConUsuario } from '../auth/interfaces/request-con-usuario.interface';
import {
  ConsultaRecorridoDto,
  ConsultaUbicacionesDto,
  LotePingsDto,
} from './dto/ubicacion.dto';
import { UbicacionesService } from './ubicaciones.service';

@ApiTags('Ubicaciones del equipo')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Sesión requerida' })
@ApiForbiddenResponse({ description: 'Sin acceso a la sección' })
@Controller('campo/ubicaciones')
@UseGuards(JwtAuthGuard)
export class UbicacionesController {
  constructor(private readonly servicio: UbicacionesService) {}

  @Get('estado')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    summary:
      'Si la jornada del usuario está activa (desde cada entrada hasta 60 min después de su salida) y cada cuánto mandar la posición',
  })
  estado(@Req() r: RequestConUsuario) {
    return this.servicio.estado(r.usuarioId);
  }

  @Post()
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Registrar posiciones propias (lote de hasta 50, idempotente por momento de captura); descarta las tomadas fuera de la jornada',
  })
  registrar(@Req() r: RequestConUsuario, @Body() d: LotePingsDto) {
    return this.servicio.registrar(r.usuarioId, d);
  }

  @Get('equipo')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    summary:
      'Última posición de hoy de cada persona: toda la empresa para superadmin, la cadena del líder con la página Ubicaciones (sin paginar, con tope)',
  })
  @ApiPayloadTooLargeResponse({ description: 'Más de 2000 personas' })
  equipo(@Req() r: RequestConUsuario, @Query() q: ConsultaUbicacionesDto) {
    return this.servicio.enVivo(r.usuarioId, q);
  }

  @Get('recorrido/:usuarioId')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    summary:
      'Recorrido de un día: puntos en orden, paradas, tramos, distancia y visitas marcadas (sin paginar, con tope)',
  })
  @ApiNotFoundResponse({ description: 'Persona fuera del alcance' })
  @ApiPayloadTooLargeResponse({ description: 'Más de 5000 puntos en el día' })
  recorrido(
    @Req() r: RequestConUsuario,
    @Param('usuarioId', ParseIntPipe) usuarioId: number,
    @Query() q: ConsultaRecorridoDto,
  ) {
    return this.servicio.recorrido(r.usuarioId, usuarioId, q);
  }
}
