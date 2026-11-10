import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { RequestConUsuario } from '../auth/interfaces/request-con-usuario.interface';

// shortcut: usuarios de prueba fijos en código mientras se prueba Pedidos; pasar a Acceso por empresa al habilitarlo.
export const USUARIOS_PRUEBA_PEDIDOS = new Set(['giselle.romero', 'falmiron']);

/** Pedidos en pruebas: superadmin, Admin TI y los usuarios de prueba. */
@Injectable()
export class PedidosAccesoGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const { usuarioId } = context
      .switchToHttp()
      .getRequest<RequestConUsuario>();
    if (!usuarioId) throw new UnauthorizedException();
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        isActive: true,
        esSuperadmin: true,
        nombreLogin: true,
        rol: { select: { esAdminTi: true } },
      },
    });
    if (
      !usuario?.isActive ||
      !(
        usuario.esSuperadmin ||
        usuario.rol?.esAdminTi ||
        USUARIOS_PRUEBA_PEDIDOS.has(usuario.nombreLogin.toLowerCase())
      )
    )
      throw new ForbiddenException('Sin acceso a pedidos');
    return true;
  }
}
