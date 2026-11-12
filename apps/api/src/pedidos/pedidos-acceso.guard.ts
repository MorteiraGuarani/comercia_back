import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccesoPlataformaService } from '../plataforma/acceso-plataforma.service';
import type { RequestConUsuario } from '../auth/interfaces/request-con-usuario.interface';

// shortcut: usuarios de prueba fijos en código mientras se prueba Pedidos; quitar cuando todos entren por Acceso por empresa.
export const USUARIOS_PRUEBA_PEDIDOS = new Set(['giselle.romero', 'falmiron']);

/**
 * Pedidos: superadmin, Admin TI, los usuarios de prueba y quien tenga la página
 * Mi jornada · Pedidos habilitada en Acceso por empresa para su rol.
 */
@Injectable()
export class PedidosAccesoGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plataforma: AccesoPlataformaService,
  ) {}

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
    if (!usuario?.isActive)
      throw new ForbiddenException('Sin acceso a pedidos');
    if (
      usuario.esSuperadmin ||
      usuario.rol?.esAdminTi ||
      USUARIOS_PRUEBA_PEDIDOS.has(usuario.nombreLogin.toLowerCase())
    )
      return true;
    // La página «pedidos» puede estar en cualquier módulo (la web la abre en todos).
    const modulos = await this.prisma.modulo.findMany({
      where: { paginas: { some: { ruta: 'pedidos' } } },
      select: { ruta: true },
      orderBy: { id: 'asc' },
      take: 20,
    });
    for (const { ruta } of modulos) {
      try {
        await this.plataforma.exigirAccesoPagina(usuarioId, ruta, 'pedidos');
        return true;
      } catch (e) {
        if (!(e instanceof ForbiddenException)) throw e;
      }
    }
    throw new ForbiddenException('Sin acceso a pedidos');
  }
}
