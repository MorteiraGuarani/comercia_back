import {
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseIntPipe,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { RequestConUsuario } from '../auth/interfaces/request-con-usuario.interface';
import {
  ConsultaCargasInventarioDto,
  OpcionesCargasInventarioDto,
} from './dto/inventario-cargas.dto';
import { InventarioCargasService } from './inventario-cargas.service';

@ApiTags('Inventarios cargados')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Sesión requerida' })
@ApiForbiddenResponse({ description: 'Sin acceso a Inventario' })
@Controller('campo/inventario/cargas')
@UseGuards(JwtAuthGuard)
export class InventarioCargasController {
  constructor(private readonly servicio: InventarioCargasService) {}

  @Get()
  @ApiOperation({
    summary: 'Cargas propias y de la cadena hacia abajo, paginadas',
  })
  listar(@Req() r: RequestConUsuario, @Query() q: ConsultaCargasInventarioDto) {
    return this.servicio.listar(r.usuarioId, q);
  }

  // Sin paginar a propósito: la exportación lleva todo el filtro (tope y 413 en el servicio).
  @Get('exportar')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="inventario.csv"')
  @ApiOperation({
    summary:
      'Cargas de la consulta en CSV para Excel (sin paginar, hasta 20000 filas)',
  })
  @ApiProduces('text/csv')
  exportar(
    @Req() r: RequestConUsuario,
    @Query() q: ConsultaCargasInventarioDto,
  ) {
    return this.servicio.exportar(r.usuarioId, q);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({
    summary:
      'Eliminar una carga dentro del alcance (queda en la base marcada como eliminada)',
  })
  eliminar(@Req() r: RequestConUsuario, @Param('id', ParseIntPipe) id: number) {
    return this.servicio.eliminar(r.usuarioId, id);
  }

  @Get('empresas')
  @ApiOperation({ summary: 'Empresas para filtrar (solo superadmin)' })
  empresas(
    @Req() r: RequestConUsuario,
    @Query() q: OpcionesCargasInventarioDto,
  ) {
    return this.servicio.empresas(r.usuarioId, q);
  }

  @Get('equipos')
  @ApiOperation({ summary: 'Equipos dentro del alcance de la sesión' })
  equipos(
    @Req() r: RequestConUsuario,
    @Query() q: OpcionesCargasInventarioDto,
  ) {
    return this.servicio.equipos(r.usuarioId, q);
  }

  @Get('responsables')
  @ApiOperation({ summary: 'Personas dentro del alcance de la sesión' })
  responsables(
    @Req() r: RequestConUsuario,
    @Query() q: OpcionesCargasInventarioDto,
  ) {
    return this.servicio.responsables(r.usuarioId, q);
  }
}
