import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { RequestConUsuario } from '../auth/interfaces/request-con-usuario.interface';
import { SuperadminGuard } from '../auth/superadmin.guard';
import { ModulosService } from './modulos.service';
import { EjecutablesService } from './ejecutables.service';
import { AsignacionesService } from './asignaciones.service';
import { MiPlataformaService } from './mi-plataforma.service';
import { ActualizarModuloDto, CrearModuloDto } from './dto/modulo.dto';
import { ActualizarPaginaDto, CrearPaginaDto } from './dto/pagina.dto';
import {
  ActualizarEjecutableDto,
  CrearEjecutableDto,
} from './dto/ejecutable.dto';
import { AsignarModuloDto } from './dto/asignacion.dto';
import {
  ActualizarConexionDto,
  CrearConexionDto,
} from './dto/conexion.dto';

// Endpoint del usuario común: su menú (auth, sin superadmin)
@ApiTags('plataforma')
@Controller('mi-plataforma')
@UseGuards(JwtAuthGuard)
export class MiPlataformaController {
  constructor(private readonly miPlataforma: MiPlataformaService) {}

  @Get()
  async menu(@Req() req: RequestConUsuario) {
    return { modulos: await this.miPlataforma.menu(req.usuarioId) };
  }
}

// ABM de la plataforma: SOLO superadmin (JwtAuthGuard + SuperadminGuard en todo)
@ApiTags('admin-plataforma')
@Controller('admin/plataforma')
@UseGuards(JwtAuthGuard, SuperadminGuard)
export class AdminPlataformaController {
  constructor(
    private readonly modulos: ModulosService,
    private readonly ejecutables: EjecutablesService,
    private readonly asignaciones: AsignacionesService,
  ) {}

  // --- Módulos (con páginas y ejecutables anidados) ---
  @Get('modulos')
  listarModulos() {
    return this.modulos.listar();
  }

  @Post('modulos')
  crearModulo(@Body() dto: CrearModuloDto) {
    return this.modulos.crearModulo(dto);
  }

  @Patch('modulos/:id')
  actualizarModulo(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarModuloDto,
  ) {
    return this.modulos.actualizarModulo(id, dto);
  }

  @Delete('modulos/:id')
  eliminarModulo(@Param('id', ParseIntPipe) id: number) {
    return this.modulos.eliminarModulo(id);
  }

  // --- Páginas ---
  @Post('paginas')
  crearPagina(@Body() dto: CrearPaginaDto) {
    return this.modulos.crearPagina(dto);
  }

  @Patch('paginas/:id')
  actualizarPagina(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarPaginaDto,
  ) {
    return this.modulos.actualizarPagina(id, dto);
  }

  @Delete('paginas/:id')
  eliminarPagina(@Param('id', ParseIntPipe) id: number) {
    return this.modulos.eliminarPagina(id);
  }

  // --- Ejecutables ---
  @Get('conexiones')
  listarConexiones() {
    return this.ejecutables.listarConexiones();
  }

  @Post('conexiones')
  crearConexion(@Body() dto: CrearConexionDto) {
    return this.ejecutables.crearConexion(dto);
  }

  @Patch('conexiones/:id')
  actualizarConexion(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarConexionDto,
  ) {
    return this.ejecutables.actualizarConexion(id, dto);
  }

  @Delete('conexiones/:id')
  eliminarConexion(@Param('id', ParseIntPipe) id: number) {
    return this.ejecutables.eliminarConexion(id);
  }

  @Post('ejecutables')
  crearEjecutable(@Body() dto: CrearEjecutableDto) {
    return this.ejecutables.crear(dto);
  }

  @Patch('ejecutables/:id')
  actualizarEjecutable(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarEjecutableDto,
  ) {
    return this.ejecutables.actualizar(id, dto);
  }

  @Delete('ejecutables/:id')
  eliminarEjecutable(@Param('id', ParseIntPipe) id: number) {
    return this.ejecutables.eliminar(id);
  }

  // --- Asignaciones empresa ↔ módulos/páginas ---
  @Get('empresas/:empresaId/asignaciones')
  asignacionesDeEmpresa(@Param('empresaId', ParseIntPipe) empresaId: number) {
    return this.asignaciones.deEmpresa(empresaId);
  }

  @Post('asignaciones')
  asignarModulo(@Body() dto: AsignarModuloDto) {
    return this.asignaciones.asignarModulo(dto);
  }

  @Delete('empresas/:empresaId/modulos/:moduloId')
  quitarModulo(
    @Param('empresaId', ParseIntPipe) empresaId: number,
    @Param('moduloId', ParseIntPipe) moduloId: number,
  ) {
    return this.asignaciones.quitarModulo(empresaId, moduloId);
  }
}
