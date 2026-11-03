import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminTiGuard } from '../auth/admin-ti.guard';
import type { RequestConUsuario } from '../auth/interfaces/request-con-usuario.interface';
import {
  ActualizarCategoriaDto,
  ConsultaCategoriasDto,
  CrearCategoriaDto,
} from './dto/categoria.dto';
import { CategoriasService } from './categorias.service';

const EJEMPLO = {
  id: 1,
  nombre_categoria: 'Hamburguesas',
  codesap: 144,
  Modo: 'T',
  orden: 1,
};

@ApiTags('Categorías de pedidos (campo_categoria)')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Sesión requerida' })
@ApiForbiddenResponse({ description: 'Solo Admin TI o superadmin' })
@Controller('campo/categorias')
// Igual que Pedidos mientras se arma: solo Admin TI y superadmin, en su empresa.
@UseGuards(JwtAuthGuard, AdminTiGuard)
export class CategoriasController {
  constructor(private readonly servicio: CategoriasService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar las categorías de la empresa, ordenadas por orden',
  })
  @ApiOkResponse({
    schema: {
      example: { items: [EJEMPLO], total: 1, page: 1, limit: 7, totalPages: 1 },
    },
  })
  listar(@Req() req: RequestConUsuario, @Query() query: ConsultaCategoriasDto) {
    return this.servicio.listar(req.usuarioId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una categoría' })
  @ApiOkResponse({ schema: { example: EJEMPLO } })
  @ApiNotFoundResponse({ description: 'Categoría no disponible' })
  obtener(
    @Req() req: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.servicio.obtener(req.usuarioId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear una categoría' })
  @ApiCreatedResponse({ schema: { example: EJEMPLO } })
  crear(@Req() req: RequestConUsuario, @Body() dto: CrearCategoriaDto) {
    return this.servicio.crear(req.usuarioId, dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Modificar una categoría (solo los campos enviados)',
  })
  @ApiOkResponse({ schema: { example: EJEMPLO } })
  @ApiNotFoundResponse({ description: 'Categoría no disponible' })
  actualizar(
    @Req() req: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarCategoriaDto,
  ) {
    return this.servicio.actualizar(req.usuarioId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar una categoría' })
  @ApiOkResponse({ schema: { example: { ok: true } } })
  @ApiNotFoundResponse({ description: 'Categoría no disponible' })
  eliminar(
    @Req() req: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.servicio.eliminar(req.usuarioId, id);
  }
}
