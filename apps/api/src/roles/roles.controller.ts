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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SuperadminGuard } from '../auth/superadmin.guard';
import type { RequestConUsuario } from '../auth/interfaces/request-con-usuario.interface';
import {
  ActualizarRolDto,
  CrearRolDto,
  ListarRolesDto,
  ListarEquiposCampoDto,
} from './dto/rol.dto';
import { RolesService } from './roles.service';

@ApiTags('administración')
@Controller('admin/roles')
@UseGuards(JwtAuthGuard, SuperadminGuard)
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get()
  listar(@Req() req: RequestConUsuario, @Query() query: ListarRolesDto) {
    return this.roles.listar(req.usuarioId, query);
  }

  @Post()
  crear(@Req() req: RequestConUsuario, @Body() dto: CrearRolDto) {
    return this.roles.crear(req.usuarioId, dto);
  }

  @Get('equipos')
  equipos(
    @Req() req: RequestConUsuario,
    @Query() query: ListarEquiposCampoDto,
  ) {
    return this.roles.equipos(req.usuarioId, query);
  }

  @Patch(':id')
  actualizar(
    @Req() req: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarRolDto,
  ) {
    return this.roles.actualizar(req.usuarioId, id, dto);
  }

  @Delete(':id')
  eliminar(
    @Req() req: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.roles.eliminar(req.usuarioId, id);
  }
}
