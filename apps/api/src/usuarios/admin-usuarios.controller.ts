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
import { ApiTags } from '@nestjs/swagger';
import type { RequestConUsuario } from '../auth/interfaces/request-con-usuario.interface';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SuperadminGuard } from '../auth/superadmin.guard';
import {
  ActualizarUsuarioDto,
  AsignarUsuarioLocalDto,
  CrearUsuarioDto,
  ListarUsuariosDto,
} from './dto/usuario.dto';
import { UsuariosService } from './usuarios.service';

@ApiTags('administración')
@Controller('admin/usuarios')
@UseGuards(JwtAuthGuard, SuperadminGuard)
export class AdminUsuariosController {
  constructor(private readonly usuarios: UsuariosService) {}

  @Get('roles')
  listarRoles(
    @Req() req: RequestConUsuario,
    @Query() query: ListarUsuariosDto,
  ) {
    return this.usuarios.listarRoles(req.usuarioId, query);
  }

  @Get('locales')
  listarLocales(
    @Req() req: RequestConUsuario,
    @Query() query: ListarUsuariosDto,
  ) {
    return this.usuarios.listarLocales(req.usuarioId, query);
  }

  @Get('meta')
  meta(@Req() req: RequestConUsuario) {
    return this.usuarios.meta(req.usuarioId);
  }

  @Get()
  listar(@Req() req: RequestConUsuario, @Query() query: ListarUsuariosDto) {
    return this.usuarios.listar(req.usuarioId, query);
  }

  @Post()
  crear(@Req() req: RequestConUsuario, @Body() dto: CrearUsuarioDto) {
    return this.usuarios.crear(req.usuarioId, dto);
  }

  @Patch(':id')
  actualizar(
    @Req() req: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarUsuarioDto,
  ) {
    return this.usuarios.actualizar(req.usuarioId, id, dto);
  }

  @Delete(':id')
  eliminar(
    @Req() req: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.usuarios.eliminar(req.usuarioId, id);
  }

  @Get(':id/asignaciones')
  listarAsignaciones(
    @Req() req: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
    @Query() query: ListarUsuariosDto,
  ) {
    return this.usuarios.listarAsignaciones(req.usuarioId, id, query);
  }

  @Post(':id/asignaciones')
  asignarLocal(
    @Req() req: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AsignarUsuarioLocalDto,
  ) {
    return this.usuarios.asignarLocal(req.usuarioId, id, dto);
  }

  @Delete(':id/asignaciones/:asignacionId')
  quitarLocal(
    @Req() req: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
    @Param('asignacionId', ParseIntPipe) asignacionId: number,
  ) {
    return this.usuarios.quitarLocal(req.usuarioId, id, asignacionId);
  }
}
