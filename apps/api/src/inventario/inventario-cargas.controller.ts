import {
  Controller,
  Delete,
  Get,
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
@ApiForbiddenResponse({ description: 'Sin acceso a Inventarios' })
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

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Borrar una carga dentro del alcance, con sus avisos',
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
