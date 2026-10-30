import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccesoPlataformaService } from '../plataforma/acceso-plataforma.service';
import type { UsuarioConAcceso } from '../plataforma/interfaces/usuario-con-acceso.interface';
import { rangoPaginacion, respuestaPaginada } from '../common/utils/paginacion';
import { PAGINA_UBICACIONES } from '../ubicaciones/ubicaciones.constants';
import type { ListarEquiposGestionDto } from './dto/equipo-gestion.dto';
import type { GestorEquipoCampo } from './interfaces/gestor-equipo.interface';
import {
  exigirEquipoCampo,
  EQUIPO_CAMPO_SELECT,
  SIN_EQUIPO_OPERATIVO,
} from './utils/equipo-campo';
import { alcanceGestor } from './utils/equipos-gestion';
import { filtroPersonalEquipoOperativo } from './utils/personal-equipo';

// Jefaturas: estas páginas muestran todos sus equipos juntos; el resto
// administra un equipo y exige elegirlo antes.
const PAGINAS_CONSULTA_GESTOR = new Set(['visitas', PAGINA_UBICACIONES]);

@Injectable()
export class CampoAccesoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plataforma: AccesoPlataformaService,
  ) {}

  async gestionar(
    usuarioId: number,
    pagina: string,
  ): Promise<UsuarioConAcceso> {
    const usuario = await this.plataforma.exigirAccesoPagina(
      usuarioId,
      'gestion-campo',
      pagina,
    );
    if (usuario.equipoCampo) {
      exigirEquipoCampo(usuario.equipoCampo);
      return usuario;
    }
    const alcance = await alcanceGestor(this.prisma, usuario.id);
    if (!alcance) throw new ForbiddenException(SIN_EQUIPO_OPERATIVO);
    if (!alcance.activo && !PAGINAS_CONSULTA_GESTOR.has(pagina))
      throw new ForbiddenException(
        'Elegí arriba con qué equipo vas a trabajar para administrar esta sección',
      );
    // El resto del flujo trabaja con el equipo elegido como si fuera propio.
    return { ...usuario, equipoCampo: alcance.activo, gestor: true };
  }

  /** Equipos que supervisa la jefatura de la sesión, para elegir con cuál trabajar. */
  async equiposGestion(usuarioId: number, query: ListarEquiposGestionDto) {
    const u = await this.prisma.usuario.findFirst({
      where: { id: usuarioId, isActive: true },
      select: { empresaId: true },
    });
    const alcance = u && (await alcanceGestor(this.prisma, usuarioId));
    if (!u || !alcance)
      throw new ForbiddenException('Tu rol no supervisa varios equipos');
    const where = {
      empresaId: u.empresaId,
      activo: true,
      ...(alcance.todos ? {} : { id: { in: alcance.ids } }),
      ...(query.buscar?.trim()
        ? {
            nombre: {
              contains: query.buscar.trim(),
              mode: 'insensitive' as const,
            },
          }
        : {}),
    };
    const { skip, take, page, limit } = rangoPaginacion(query);
    const [total, items] = await Promise.all([
      this.prisma.equipoCampo.count({ where }),
      this.prisma.equipoCampo.findMany({
        where,
        select: EQUIPO_CAMPO_SELECT,
        orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
        skip,
        take,
      }),
    ]);
    return respuestaPaginada(items, total, page, limit);
  }

  /** null vuelve a mostrar todos sus equipos juntos. */
  async elegirEquipoGestion(usuarioId: number, equipoId: number | null) {
    const alcance = await alcanceGestor(this.prisma, usuarioId);
    if (!alcance)
      throw new ForbiddenException('Tu rol no supervisa varios equipos');
    if (equipoId !== null) {
      const disponible =
        (alcance.todos || alcance.ids.includes(equipoId)) &&
        (await this.prisma.equipoCampo.count({
          where: {
            id: equipoId,
            activo: true,
            empresa: { usuarios: { some: { id: usuarioId } } },
          },
        }));
      if (!disponible)
        throw new ForbiddenException('Ese equipo no está entre los tuyos');
    }
    const { equipoGestion } = await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: { equipoGestionId: equipoId },
      select: { equipoGestion: { select: EQUIPO_CAMPO_SELECT } },
    });
    return { equipo: equipoGestion };
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
      // Supervisores con Itinerario: recorren desde Gestión de campo la ruta
      // que heredan de su cadena, con su propio equipo.
      const lider = await this.plataforma
        .exigirAccesoPagina(usuarioId, 'gestion-campo', 'itinerario')
        .catch((e: unknown) => {
          if (e instanceof ForbiddenException) return null;
          throw e;
        });
      if (lider?.equipoCampo?.activo) {
        exigirEquipoCampo(lider.equipoCampo);
        return lider;
      }
      const usuario = await this.gestionar(usuarioId, 'locales');
      const rol = usuario.rolDescripcion?.toLowerCase().replace(/[^a-z]/g, '');
      if (rol !== 'teamleader' && rol !== 'teamleaderimpulsador') throw error;
      return usuario;
    }
  }
  /** Jefe: avance de todo su organigrama (módulo Jefatura, página Avance). */
  jefatura(usuarioId: number) {
    return this.plataforma.exigirAccesoPagina(usuarioId, 'jefatura', 'avance');
  }
  async local(empresaId: number, id: string) {
    const local = await this.prisma.socioNegocio.findFirst({
      where: { CardCode: id, empresaId },
      select: { CardCode: true },
    });
    if (!local) throw new NotFoundException('Local no disponible');
    return local;
  }
  /** gestor: el usuario que devolvió gestionar(), con el equipo con el que trabaja. */
  async subordinado(gestor: GestorEquipoCampo, usuarioId: number) {
    // El ABM administra su equipo operativo aunque el personal no dependa
    // jerárquicamente del gestor. Conserva empresa, estado y equipo exacto.
    const personal = filtroPersonalEquipoOperativo(gestor);
    const colaborador = await this.prisma.usuario.findFirst({
      where: { AND: [personal, { id: usuarioId }] },
      select: { id: true },
    });
    if (!colaborador)
      throw new NotFoundException('Usuario no disponible en tu equipo');
    await this.ejecutar(usuarioId);
    return { id: usuarioId };
  }
}
