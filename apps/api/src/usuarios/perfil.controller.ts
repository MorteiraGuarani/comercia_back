import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { RequestConUsuario } from '../auth/interfaces/request-con-usuario.interface';
import type { UsuarioSesion } from '../auth/interfaces/usuario-sesion.interface';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthService } from '../auth/auth.service';
import { enviarArchivo } from '../common/utils/enviar-archivo';
import { ActualizarPerfilDto } from './dto/perfil.dto';
import { multerConfigFotoPerfil } from './utils/multer-foto-perfil';
import { UsuariosService } from './usuarios.service';

// "Mis datos" de cualquier rol: solo actúa sobre el usuario de la sesión.
@ApiTags('perfil')
@Controller('perfil')
@UseGuards(JwtAuthGuard)
export class PerfilController {
  constructor(
    private readonly usuarios: UsuariosService,
    private readonly auth: AuthService,
  ) {}

  @Patch()
  @ApiOperation({
    summary: 'Editar mis datos',
    description:
      'Nombre, apellido, correo, RUC y celular del usuario de la sesión. Solo superadmin y roles administrativos (back office, manager…); los roles de campo reciben 403. Rol, superior, legajo y usuario no se editan acá (400).',
  })
  async actualizar(
    @Req() r: RequestConUsuario,
    @Body() dto: ActualizarPerfilDto,
  ): Promise<{ usuario: UsuarioSesion }> {
    await this.usuarios.actualizarPerfil(r.usuarioId, dto);
    return { usuario: await this.auth.me(r.usuarioId) };
  }

  @Post('foto')
  @UseInterceptors(FileInterceptor('foto', multerConfigFotoPerfil))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['foto'],
      properties: { foto: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({
    summary: 'Subir mi foto de perfil',
    description:
      'JPG, PNG o WebP de hasta 5 MB. Reemplaza la anterior. Los roles de campo reciben 403.',
  })
  async subirFoto(
    @Req() r: RequestConUsuario,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ usuario: UsuarioSesion }> {
    await this.usuarios.guardarFotoPerfil(r.usuarioId, file);
    return { usuario: await this.auth.me(r.usuarioId) };
  }

  @Delete('foto')
  @ApiOperation({ summary: 'Quitar mi foto de perfil' })
  async quitarFoto(
    @Req() r: RequestConUsuario,
  ): Promise<{ usuario: UsuarioSesion }> {
    await this.usuarios.quitarFotoPerfil(r.usuarioId);
    return { usuario: await this.auth.me(r.usuarioId) };
  }

  @Get('foto')
  @ApiOperation({ summary: 'Ver mi foto de perfil' })
  async verFoto(@Req() r: RequestConUsuario, @Res() res: Response) {
    const foto = await this.usuarios.fotoPerfil(r.usuarioId);
    if (!foto) return res.status(404).json({ message: 'Sin foto de perfil' });
    // La URL lleva ?v=<versión>: puede quedar en la caché del navegador.
    enviarArchivo(res, foto.ruta, {
      'Content-Type': foto.mime,
      'Cache-Control': 'private, max-age=86400',
    });
  }
}
