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
import { SuperadminGuard } from '../auth/superadmin.guard';
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
@ApiForbiddenResponse({ description: 'Solo superadmin' })
@ApiNotFoundResponse({ description: 'Empresa no disponible' })
// Administración → Categorías: solo el superadmin, sobre la empresa que elige.
@Controller('admin/empresas/:empresaId/categorias')
@UseGuards(JwtAuthGuard, SuperadminGuard)
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
  listar(
    @Param('empresaId', ParseIntPipe) empresaId: number,
    @Query() query: ConsultaCategoriasDto,
  ) {
    return this.servicio.listar(empresaId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una categoría' })
  @ApiOkResponse({ schema: { example: EJEMPLO } })
  @ApiNotFoundResponse({ description: 'Categoría no disponible' })
  obtener(
    @Param('empresaId', ParseIntPipe) empresaId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.servicio.obtener(empresaId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear una categoría' })
  @ApiCreatedResponse({ schema: { example: EJEMPLO } })
  crear(
    @Param('empresaId', ParseIntPipe) empresaId: number,
    @Body() dto: CrearCategoriaDto,
  ) {
    return this.servicio.crear(empresaId, dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Modificar una categoría (solo los campos enviados)',
  })
  @ApiOkResponse({ schema: { example: EJEMPLO } })
  @ApiNotFoundResponse({ description: 'Categoría no disponible' })
  actualizar(
    @Param('empresaId', ParseIntPipe) empresaId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarCategoriaDto,
  ) {
    return this.servicio.actualizar(empresaId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar una categoría' })
  @ApiOkResponse({ schema: { example: { ok: true } } })
  @ApiNotFoundResponse({ description: 'Categoría no disponible' })
  eliminar(
    @Param('empresaId', ParseIntPipe) empresaId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.servicio.eliminar(empresaId, id);
  }
}
