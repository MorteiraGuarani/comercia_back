import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Response } from 'express';
import { AUTH_COOKIE, TOKEN_DURACION_MS } from './auth.constants';
import type { TokenPayload } from './interfaces/token-payload.interface';
import type { RequestConUsuario } from './interfaces/request-con-usuario.interface';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestConUsuario>();
    const authorization = request.headers?.authorization;
    const bearer =
      typeof authorization === 'string' && authorization.startsWith('Bearer ')
        ? authorization.slice('Bearer '.length).trim()
        : null;
    const token =
      bearer ||
      (request.cookies as Record<string, string> | undefined)?.[AUTH_COOKIE];
    if (!token) {
      throw new UnauthorizedException('Sesión no iniciada');
    }
    let payload: TokenPayload;
    try {
      payload = this.jwt.verify<TokenPayload>(token);
    } catch {
      throw new UnauthorizedException('Sesión inválida o expirada');
    }
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: payload.sub },
      select: { isActive: true, empresaId: true },
    });
    if (!usuario?.isActive) {
      throw new UnauthorizedException('Sesión inválida o expirada');
    }
    request.usuarioId = payload.sub;
    request.empresaId = usuario.empresaId;
    // Solo la sesión web renueva su cookie. El token Bearer de la app móvil
    // permanece aislado de las cookies httpOnly del navegador.
    if (!bearer) {
      const response = context.switchToHttp().getResponse<Response>();
      response?.cookie(AUTH_COOKIE, this.jwt.sign({ sub: payload.sub }), {
        httpOnly: true,
        sameSite: 'lax',
        secure: false,
        maxAge: TOKEN_DURACION_MS,
        path: '/',
      });
    }
    return true;
  }
}
