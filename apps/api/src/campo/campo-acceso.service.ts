import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccesoPlataformaService } from '../plataforma/acceso-plataforma.service';
import {
  rolDelEquipoCampo,
  exigirEquipoCampo,
  EQUIPO_CAMPO_SELECT,
} from './utils/equipo-campo';

@Injectable()
export class CampoAccesoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plataforma: AccesoPlataformaService,
  ) {}

  async gestionar(usuarioId: number, pagina: string) {
    const usuario = await this.plataforma.exigirAccesoPagina(
      usuarioId,
      'gestion-campo',
      pagina,
    );
    exigirEquipoCampo(usuario.equipoCampo);
    return usuario;
  }
  async ejecutar(usuarioId: number) {
    try {
      const usuario = await this.plataforma.exigirAccesoAlgunaPagina(
        usuarioId,
        'mi-jornada',
        ['locales', 'tareas'],
      );
      exigirEquipoCampo(usuario.equipoCampo);
      return usuario;
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
    const superior = await this.prisma.usuario.findFirst({
      where: { id: superiorId, empresaId, isActive: true },
      select: {
        rol: { select: { equipoCampo: { select: EQUIPO_CAMPO_SELECT } } },
      },
    });
    if (!superior)
      throw new NotFoundException('Usuario no disponible en tu equipo');
    const usuario = await this.prisma.usuario.findFirst({
      where: {
        id: usuarioId,
        empresaId,
        superiorId,
        isActive: true,
        esSuperadmin: false,
        rol: rolDelEquipoCampo(superior.rol?.equipoCampo),
      },
      select: { id: true },
    });
    if (!usuario)
      throw new NotFoundException('Usuario no disponible en tu equipo');
    await this.ejecutar(usuario.id);
    return usuario;
  }
}
