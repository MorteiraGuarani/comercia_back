import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { RequestConUsuario } from './interfaces/request-con-usuario.interface';

/** Solo para las áreas de administración autorizadas a TI. */
@Injectable()
export class AdminTiGuard implements CanActivate {
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
        rol: { select: { esAdminTi: true } },
      },
    });
    if (!usuario?.isActive || !(usuario.esSuperadmin || usuario.rol?.esAdminTi))
      throw new ForbiddenException('Sin acceso a esta administración');
    return true;
  }
}
