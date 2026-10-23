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
  ApiBody,
  ApiExtraModels,
  ApiOperation,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import type { RequestConUsuario } from '../auth/interfaces/request-con-usuario.interface';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SuperadminGuard } from '../auth/superadmin.guard';
import {
  ActualizarUsuarioDto,
  ActualizarUsuarioLoteDto,
  AsignarUsuarioLocalDto,
  CrearUsuarioDto,
  DesactivarUsuarioLoteDto,
  ListarUsuariosDto,
} from './dto/usuario.dto';
import type { FilasLoteUsuarios } from './interfaces/lote-usuarios.interface';
import {
  LoteUsuariosPipe,
  MAX_USUARIOS_POR_LOTE,
} from './pipes/lote-usuarios.pipe';

const unoOLote = (Dto: new () => object) => ({
  oneOf: [
    { $ref: getSchemaPath(Dto) },
    {
      type: 'array',
      minItems: 1,
      maxItems: MAX_USUARIOS_POR_LOTE,
      items: { $ref: getSchemaPath(Dto) },
    },
  ],
});

const RESUMEN_LOTE = {
  description:
    'Con un arreglo: resumen del lote. Cada fila se procesa sola; las que fallan no frenan a las demás y quedan al final en `errores` con su posición (`indice`, desde 0) y el motivo.',
  schema: {
    example: {
      total: 3,
      exitosos: 2,
      fallidos: 1,
      resultados: ['…'],
      errores: [
        {
          indice: 2,
          usuario: 'jperez',
          error: 'Ese nombre de usuario ya está en uso',
        },
      ],
    },
  },
};
import { UsuariosService } from './usuarios.service';
import { ListarSuperioresDto } from './dto/listar-superiores.dto';

@ApiTags('administración')
@ApiExtraModels(CrearUsuarioDto, ActualizarUsuarioLoteDto, DesactivarUsuarioLoteDto)
@Controller('admin/usuarios')
@UseGuards(JwtAuthGuard, SuperadminGuard)
export class AdminUsuariosController {
  constructor(private readonly usuarios: UsuariosService) {}

  @Get('superiores')
  listarSuperiores(
    @Req() req: RequestConUsuario,
    @Query() query: ListarSuperioresDto,
  ) {
    return this.usuarios.listarSuperiores(req.usuarioId, query);
  }

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
  @ApiOperation({
    summary: 'Crear usuarios: uno (objeto) o varios (arreglo)',
    description: `Todos los campos son opcionales. Lo que falta se completa así: nombreLogin sale del correo (lo anterior a la @) o se genera (usuario-xxxxxxxx); correo, \`<nombreLogin>@sin-correo.invalid\`; nombre, el nombreLogin; apellido y datos personales, vacíos; contraseña, configurada internamente; celularPais, PY; empresa, la del superadmin; sin rol ni superior. Un objeto devuelve el usuario creado (y 400/409 si falla). Un arreglo (hasta ${MAX_USUARIOS_POR_LOTE}) devuelve el resumen con los errores al final.`,
  })
  @ApiBody({ schema: unoOLote(CrearUsuarioDto) })
  @ApiResponse({ status: 201, ...RESUMEN_LOTE })
  async crear(
    @Req() req: RequestConUsuario,
    @Body(new LoteUsuariosPipe(CrearUsuarioDto))
    cuerpo: FilasLoteUsuarios<CrearUsuarioDto>,
  ) {
    const [fila] = cuerpo.filas;
    return cuerpo.lote || !('dto' in fila)
      ? this.usuarios.crearLote(req.usuarioId, cuerpo.filas)
      : this.usuarios.crear(req.usuarioId, fila.dto);
  }

  @Patch()
  @ApiOperation({
    summary: 'Modificar varios usuarios',
    description: `Arreglo (hasta ${MAX_USUARIOS_POR_LOTE}) de objetos con el id del usuario y solo los campos a cambiar; todos opcionales salvo id. Devuelve el resumen con los errores al final.`,
  })
  @ApiBody({ schema: unoOLote(ActualizarUsuarioLoteDto) })
  @ApiResponse({ status: 200, ...RESUMEN_LOTE })
  actualizarLote(
    @Req() req: RequestConUsuario,
    @Body(new LoteUsuariosPipe(ActualizarUsuarioLoteDto))
    cuerpo: FilasLoteUsuarios<ActualizarUsuarioLoteDto>,
  ) {
    return this.usuarios.actualizarLote(req.usuarioId, cuerpo.filas);
  }

  @Delete()
  @ApiOperation({
    summary: 'Desactivar varios usuarios',
    description: `Arreglo (hasta ${MAX_USUARIOS_POR_LOTE}) de objetos { id }. Igual que el DELETE individual, conserva la cuenta y bloquea el acceso. Devuelve el resumen con los errores al final.`,
  })
  @ApiBody({ schema: unoOLote(DesactivarUsuarioLoteDto) })
  @ApiResponse({ status: 200, ...RESUMEN_LOTE })
  eliminarLote(
    @Req() req: RequestConUsuario,
    @Body(new LoteUsuariosPipe(DesactivarUsuarioLoteDto))
    cuerpo: FilasLoteUsuarios<DesactivarUsuarioLoteDto>,
  ) {
    return this.usuarios.eliminarLote(req.usuarioId, cuerpo.filas);
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
