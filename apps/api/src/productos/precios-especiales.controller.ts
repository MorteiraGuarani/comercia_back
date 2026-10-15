import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCookieAuth,
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
import type { RequestConUsuario } from '../auth/interfaces/request-con-usuario.interface';
import { PreciosEspecialesService } from './precios-especiales.service';
import { EmpresaCatalogoParams } from './dto/catalogo.dto';
import {
  ConsultaPrecioEspecialDto,
  PaginaPrecioEspecialDetalleDto,
  PaginaPrecioEspecialDto,
  PrecioEspecialDetalleDto,
  PrecioEspecialDetalleRespuestaDto,
  PrecioEspecialDto,
  PrecioEspecialParams,
  PrecioEspecialRespuestaDto,
} from './dto/precio-especial.dto';

const ELIMINADO = {
  description: 'Registro eliminado',
  schema: {
    type: 'object',
    properties: { ok: { type: 'boolean', example: true } },
  },
};
const PARCIAL =
  'Todos los campos son opcionales: solo cambian los enviados y null vacía el campo.';

@Controller('admin/catalogo')
@ApiTags('Precios especiales')
@ApiBearerAuth()
@ApiCookieAuth()
@ApiUnauthorizedResponse({ description: 'Sesión no iniciada o expirada' })
@ApiForbiddenResponse({
  description: 'Requiere permisos de superadministrador',
})
@ApiNotFoundResponse({ description: 'Empresa o registro no disponible' })
@UseGuards(JwtAuthGuard, SuperadminGuard)
export class PreciosEspecialesController {
  constructor(private readonly servicio: PreciosEspecialesService) {}

  @Get('empresas/:empresaId/precios-especiales')
  @ApiOperation({
    summary: 'Listar precios especiales (tbl_ospp)',
    description:
      'Paginado (7 por defecto, máximo 50). Filtra por cliente y artículo exactos o por texto.',
  })
  @ApiOkResponse({ type: PaginaPrecioEspecialDto })
  listar(
    @Req() r: RequestConUsuario,
    @Param() p: EmpresaCatalogoParams,
    @Query() q: ConsultaPrecioEspecialDto,
  ) {
    return this.servicio.listar(r.usuarioId, p.empresaId, q);
  }

  @Post('empresas/:empresaId/precios-especiales')
  @ApiOperation({
    summary: 'Crear precio especial (tbl_ospp)',
    description: 'Todos los campos son opcionales.',
  })
  @ApiCreatedResponse({ type: PrecioEspecialRespuestaDto })
  @ApiBadRequestResponse({ description: 'Datos inválidos' })
  @ApiConflictResponse({
    description: 'Ya existe con el mismo artículo, lista, cliente y tipo',
  })
  crear(
    @Req() r: RequestConUsuario,
    @Param() p: EmpresaCatalogoParams,
    @Body() d: PrecioEspecialDto,
  ) {
    return this.servicio.crear(r.usuarioId, p.empresaId, d);
  }

  @Patch('empresas/:empresaId/precios-especiales/:id')
  @ApiOperation({
    summary: 'Editar precio especial (tbl_ospp)',
    description: PARCIAL,
  })
  @ApiOkResponse({ type: PrecioEspecialRespuestaDto })
  @ApiBadRequestResponse({ description: 'Datos inválidos' })
  @ApiConflictResponse({
    description: 'Ya existe con el mismo artículo, lista, cliente y tipo',
  })
  editar(
    @Req() r: RequestConUsuario,
    @Param() p: PrecioEspecialParams,
    @Body() d: PrecioEspecialDto,
  ) {
    return this.servicio.editar(r.usuarioId, p.empresaId, p.id, d);
  }

  @Delete('empresas/:empresaId/precios-especiales/:id')
  @ApiOperation({ summary: 'Eliminar precio especial (tbl_ospp)' })
  @ApiOkResponse(ELIMINADO)
  eliminar(@Req() r: RequestConUsuario, @Param() p: PrecioEspecialParams) {
    return this.servicio.eliminar(r.usuarioId, p.empresaId, p.id);
  }

  @Get('empresas/:empresaId/precios-especiales-detalle')
  @ApiOperation({
    summary: 'Listar detalle de precios especiales (tbl_spp1)',
    description:
      'Paginado (7 por defecto, máximo 50). Para ver el detalle de un precio especial, filtrar por su cardCode e itemCode.',
  })
  @ApiOkResponse({ type: PaginaPrecioEspecialDetalleDto })
  listarDetalle(
    @Req() r: RequestConUsuario,
    @Param() p: EmpresaCatalogoParams,
    @Query() q: ConsultaPrecioEspecialDto,
  ) {
    return this.servicio.listarDetalle(r.usuarioId, p.empresaId, q);
  }

  @Post('empresas/:empresaId/precios-especiales-detalle')
  @ApiOperation({
    summary: 'Crear detalle de precio especial (tbl_spp1)',
    description: 'Todos los campos son opcionales.',
  })
  @ApiCreatedResponse({ type: PrecioEspecialDetalleRespuestaDto })
  @ApiBadRequestResponse({ description: 'Datos inválidos' })
  @ApiConflictResponse({
    description: 'Ya existe con el mismo cliente, artículo, línea y lista',
  })
  crearDetalle(
    @Req() r: RequestConUsuario,
    @Param() p: EmpresaCatalogoParams,
    @Body() d: PrecioEspecialDetalleDto,
  ) {
    return this.servicio.crearDetalle(r.usuarioId, p.empresaId, d);
  }

  @Patch('empresas/:empresaId/precios-especiales-detalle/:id')
  @ApiOperation({
    summary: 'Editar detalle de precio especial (tbl_spp1)',
    description: PARCIAL,
  })
  @ApiOkResponse({ type: PrecioEspecialDetalleRespuestaDto })
  @ApiBadRequestResponse({ description: 'Datos inválidos' })
  @ApiConflictResponse({
    description: 'Ya existe con el mismo cliente, artículo, línea y lista',
  })
  editarDetalle(
    @Req() r: RequestConUsuario,
    @Param() p: PrecioEspecialParams,
    @Body() d: PrecioEspecialDetalleDto,
  ) {
    return this.servicio.editarDetalle(r.usuarioId, p.empresaId, p.id, d);
  }

  @Delete('empresas/:empresaId/precios-especiales-detalle/:id')
  @ApiOperation({ summary: 'Eliminar detalle de precio especial (tbl_spp1)' })
  @ApiOkResponse(ELIMINADO)
  eliminarDetalle(
    @Req() r: RequestConUsuario,
    @Param() p: PrecioEspecialParams,
  ) {
    return this.servicio.eliminarDetalle(r.usuarioId, p.empresaId, p.id);
  }
}
