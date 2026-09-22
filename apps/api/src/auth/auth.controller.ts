import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { AUTH_COOKIE, TOKEN_DURACION_MS } from './auth.constants';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { LoginSimDto } from './dto/login-sim.dto';
import { CallbackUcheckSsoDto } from './dto/callback-ucheck-sso.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { UsuarioSesion } from './interfaces/usuario-sesion.interface';
import type { RequestConUsuario } from './interfaces/request-con-usuario.interface';
import { UcheckSsoService } from './ucheck-sso.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly ucheckSso: UcheckSsoService,
  ) {}

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ApiOperation({ summary: 'Iniciar sesión con RUC y contraseña' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ usuario: UsuarioSesion }> {
    const { usuario, token } = await this.authService.login(dto);
    this.setAuthCookie(res, token);
    return { usuario };
  }

  // La app nativa no puede leer la cookie httpOnly de la web. Este endpoint
  // entrega el mismo JWT solamente tras validar usuario y contraseña; no usa
  // la SIM ni el número de teléfono como credencial.
  @Post('mobile/login')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ApiOperation({ summary: 'Iniciar sesión desde la app móvil' })
  loginMovil(
    @Body() dto: LoginDto,
  ): Promise<{ usuario: UsuarioSesion; token: string }> {
    return this.authService.login(dto);
  }

  @Post('mobile/sim-login')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({ summary: 'Intentar inicio de sesión con SIM disponible' })
  loginMovilConSim(
    @Body() dto: LoginSimDto,
  ): Promise<{ usuario: UsuarioSesion; token: string }> {
    return this.authService.loginMovilConSim(dto);
  }

  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cerrar la sesión' })
  logout(@Res({ passthrough: true }) res: Response): { ok: true } {
    res.clearCookie(AUTH_COOKIE, { path: '/' });
    return { ok: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Usuario de la sesión actual' })
  async me(@Req() req: RequestConUsuario): Promise<{ usuario: UsuarioSesion }> {
    return { usuario: await this.authService.me(req.usuarioId) };
  }

  // Excepción pública deliberada: el código es opaco, dura 60 segundos, se
  // consume una sola vez y Comercia lo valida de servidor a servidor con UCHECK.
  @Get('ucheck/callback')
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  @ApiOperation({ summary: 'Completar el SSO iniciado desde el APK de UCHECK' })
  async callbackUcheck(
    @Query() dto: CallbackUcheckSsoDto,
    @Res() res: Response,
  ): Promise<void> {
    const { token, destino } = await this.ucheckSso.iniciarSesion(dto.code);
    this.setAuthCookie(res, token);
    res.redirect(302, destino);
  }

  private setAuthCookie(res: Response, token: string): void {
    res.cookie(AUTH_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      // secure:false porque producción corre por HTTP en la LAN (sin dominio).
      // Cambiar a true cuando haya HTTPS con Caddy.
      secure: false,
      maxAge: TOKEN_DURACION_MS,
      path: '/',
    });
  }
}
