import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccesoPlataformaService } from '../plataforma/acceso-plataforma.service';

@Injectable()
export class CampoAccesoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plataforma: AccesoPlataformaService,
  ) {}

  gestionar(usuarioId: number, pagina: string) {
    return this.plataforma.exigirAccesoPagina(
      usuarioId,
      'gestion-campo',
      pagina,
    );
  }
  async ejecutar(usuarioId: number) {
    try {
      return await this.plataforma.exigirAccesoAlgunaPagina(
        usuarioId,
        'mi-jornada',
        ['locales', 'tareas'],
      );
    } catch (error) {
      if (!(error instanceof ForbiddenException)) throw error;
      const usuario = await this.gestionar(usuarioId, 'locales');
      const rol = usuario.rolDescripcion?.toLowerCase().replace(/[^a-z]/g, '');
      if (rol !== 'teamleader' && rol !== 'teamleaderimpulsador') throw error;
      return usuario;
    }
  }
  async local(empresaId: number, id: number) {
    const local = await this.prisma.localCampo.findFirst({
      where: { id, cliente: { empresaId } },
      select: { id: true, activo: true, cliente: { select: { activo: true } } },
    });
    if (!local) throw new NotFoundException('Local no disponible');
    return local;
  }
  async subordinado(empresaId: number, superiorId: number, usuarioId: number) {
    const usuario = await this.prisma.usuario.findFirst({
      where: {
        id: usuarioId,
        empresaId,
        superiorId,
        isActive: true,
        esSuperadmin: false,
      },
      select: { id: true },
    });
    if (!usuario)
      throw new NotFoundException('Usuario no disponible en tu equipo');
    const superior = await this.prisma.usuario.findUnique({
      where: { id: superiorId },
      select: { rol: { select: { descripcion: true } } },
    });
    if (superior?.rol?.descripcion === 'SUPERVISOR_REPOSITORES') {
      const colaborador = await this.prisma.usuario.findUnique({
        where: { id: usuarioId },
        select: { rol: { select: { descripcion: true } } },
      });
      if (colaborador?.rol?.descripcion !== 'REPOSITOR')
        throw new NotFoundException('Repositor no disponible en tu equipo');
    }
    await this.ejecutar(usuario.id);
    return usuario;
  }
}
