import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificacionService } from './notificacion.service';
import {
  ActualizarEstadoNovedadDto,
  CrearNovedadDto,
  ListarNovedadesDto,
} from '../dto/novedad.dto';
import {
  rangoPaginacion,
  respuestaPaginada,
} from '../../common/utils/paginacion';
import { esLiderDe, obtenerEquipoCompleto } from '../utils/autorizacion';
import { localesParaNovedad } from '../utils/locales-novedad';
import { ConsultaCampoDto } from '../dto/campo.dto';

@Injectable()
export class NovedadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificaciones: NotificacionService,
  ) {}

  async locales(usuarioId: number, empresaId: number, query: ConsultaCampoDto) {
    const where: Prisma.LocalCampoWhereInput = {
      ...localesParaNovedad(usuarioId, empresaId),
      ...(query.buscar ? { nombre: { contains: query.buscar, mode: 'insensitive' } } : {}),
    };
    const { skip, take, page, limit } = rangoPaginacion(query);
    const [total, items] = await Promise.all([
      this.prisma.localCampo.count({ where }),
      this.prisma.localCampo.findMany({
        where, select: { id: true, nombre: true },
        orderBy: [{ nombre: 'asc' }, { id: 'asc' }], skip, take,
      }),
    ]);
    return respuestaPaginada(items, total, page, limit);
  }

  /**
   * Crear novedad reportada por un impulsador
   */
  async crear(
    usuarioId: number,
    empresaId: number,
    dto: CrearNovedadDto,
  ) {
    // Validar existencia del local en la empresa
    const local = await this.prisma.localCampo.findFirst({
      where: {
        ...localesParaNovedad(usuarioId, empresaId),
        id: dto.localId,
      },
      select: { id: true, nombre: true },
    });
    if (!local) {
      throw new NotFoundException('Local no encontrado o inactivo');
    }

    // Validar tarea opcional
    if (dto.tareaId) {
      const tarea = await this.prisma.tareaCampo.findFirst({
        where: { id: dto.tareaId, empresaId, activo: true },
        select: { id: true, nombre: true },
      });
      if (!tarea) {
        throw new NotFoundException('Tarea no encontrada o inactiva');
      }
    }

    // Validar visita opcional
    if (dto.visitaId) {
      const visita = await this.prisma.visitaCampo.findFirst({
        where: { id: dto.visitaId, localId: dto.localId, usuarioId },
        select: { id: true },
      });
      if (!visita) {
        throw new BadRequestException('La visita especificada no corresponde al local o usuario');
      }
    }

    const novedad = await this.prisma.novedadCampo.create({
      data: {
        empresaId,
        usuarioId,
        localId: dto.localId,
        tareaId: dto.tareaId ?? null,
        visitaId: dto.visitaId ?? null,
        tipo: dto.tipo,
        prioridad: dto.prioridad ?? 'NORMAL',
        titulo: dto.titulo.trim(),
        descripcion: dto.descripcion.trim(),
        estado: 'ABIERTA',
      },
      include: {
        usuario: { select: { id: true, nombre: true, apellido: true } },
        local: { select: { id: true, nombre: true, direccion: true, cliente: { select: { nombre: true } } } },
        tarea: { select: { id: true, nombre: true, categoria: true } },
      },
    });

    // Notificar al Team Leader automáticamente
    try {
      await this.notificaciones.crearNotificacionNovedad(
        empresaId,
        usuarioId,
        novedad.id,
        local.nombre,
        dto.tipo,
      );
    } catch {
      // No fallar la creación si la notificación falla
    }

    return novedad;
  }

  /**
   * Listar novedades con filtros y conteos por estado (Abierta, Cerrada, Cancelada)
   */
  async listar(
    usuarioId: number,
    empresaId: number,
    dto: ListarNovedadesDto,
  ) {
    const { skip, take, page, limit } = rangoPaginacion(dto);

    // Determinar usuarios a los que tiene acceso
    const equipoIds = await obtenerEquipoCompleto(this.prisma, usuarioId);
    const esLider = equipoIds.length > 1;

    let usuariosFiltrados: number[];
    if (dto.usuarioId) {
      if (!equipoIds.includes(dto.usuarioId)) {
        throw new ForbiddenException('No tienes acceso a novedades de este usuario');
      }
      usuariosFiltrados = [dto.usuarioId];
    } else {
      usuariosFiltrados = esLider ? equipoIds : [usuarioId];
    }

    const baseWhere: Prisma.NovedadCampoWhereInput = {
      empresaId,
      usuarioId: { in: usuariosFiltrados },
      ...(dto.localId ? { localId: dto.localId } : {}),
      ...(dto.tareaId ? { tareaId: dto.tareaId } : {}),
    };

    const whereConEstado: Prisma.NovedadCampoWhereInput = {
      ...baseWhere,
      ...(dto.estado ? { estado: dto.estado } : {}),
    };

    const [items, total, countAbiertas, countCerradas, countCanceladas] =
      await Promise.all([
        this.prisma.novedadCampo.findMany({
          where: whereConEstado,
          include: {
            usuario: { select: { id: true, nombre: true, apellido: true } },
            local: { select: { id: true, nombre: true, direccion: true, cliente: { select: { nombre: true } } } },
            tarea: { select: { id: true, nombre: true, categoria: true } },
            cerradoPor: { select: { id: true, nombre: true, apellido: true } },
          },
          orderBy: { creadoAt: 'desc' },
          skip,
          take,
        }),
        this.prisma.novedadCampo.count({ where: whereConEstado }),
        this.prisma.novedadCampo.count({ where: { ...baseWhere, estado: 'ABIERTA' } }),
        this.prisma.novedadCampo.count({ where: { ...baseWhere, estado: 'CERRADA' } }),
        this.prisma.novedadCampo.count({ where: { ...baseWhere, estado: 'CANCELADA' } }),
      ]);

    const paginada = respuestaPaginada(items, total, page, limit);
    return {
      ...paginada,
      counts: {
        abierta: countAbiertas,
        cerrada: countCerradas,
        cancelada: countCanceladas,
        total: countAbiertas + countCerradas + countCanceladas,
      },
    };
  }

  /**
   * Obtener detalle de una novedad
   */
  async obtenerPorId(usuarioId: number, id: number) {
    const novedad = await this.prisma.novedadCampo.findUnique({
      where: { id },
      include: {
        usuario: { select: { id: true, nombre: true, apellido: true } },
        local: { select: { id: true, nombre: true, direccion: true, cliente: { select: { nombre: true } } } },
        tarea: { select: { id: true, nombre: true, categoria: true } },
        cerradoPor: { select: { id: true, nombre: true, apellido: true } },
      },
    });

    if (!novedad) {
      throw new NotFoundException('Novedad no encontrada');
    }

    const equipoIds = await obtenerEquipoCompleto(this.prisma, usuarioId);
    if (!equipoIds.includes(novedad.usuarioId)) {
      throw new ForbiddenException('No tienes acceso a esta novedad');
    }

    return novedad;
  }

  /**
   * Actualizar estado de una novedad (Cerrar o Cancelar con resolución)
   */
  async actualizarEstado(
    usuarioId: number,
    id: number,
    dto: ActualizarEstadoNovedadDto,
  ) {
    const novedad = await this.prisma.novedadCampo.findUnique({
      where: { id },
      include: {
        local: { select: { nombre: true } },
      },
    });

    if (!novedad) {
      throw new NotFoundException('Novedad no encontrada');
    }

    const esAutor = novedad.usuarioId === usuarioId;
    const esLider = await esLiderDe(this.prisma, usuarioId, novedad.usuarioId);

    // El autor solo puede cancelar su propia novedad si aún está abierta
    if (esAutor && !esLider) {
      if (dto.estado !== 'CANCELADA') {
        throw new ForbiddenException('Solo un supervisor puede cerrar la novedad');
      }
      if (novedad.estado !== 'ABIERTA') {
        throw new BadRequestException('Solo podés cancelar una novedad abierta');
      }
    } else if (!esLider) {
      const equipoIds = await obtenerEquipoCompleto(this.prisma, usuarioId);
      if (!equipoIds.includes(novedad.usuarioId)) {
        throw new ForbiddenException('No tienes permisos para modificar esta novedad');
      }
    }

    const actualizada = await this.prisma.novedadCampo.update({
      where: { id },
      data: {
        estado: dto.estado,
        resolucion: dto.resolucion ? dto.resolucion.trim() : null,
        cerradoPorId: usuarioId,
        cerradoAt: new Date(),
      },
      include: {
        usuario: { select: { id: true, nombre: true, apellido: true } },
        local: { select: { id: true, nombre: true, cliente: { select: { nombre: true } } } },
        tarea: { select: { id: true, nombre: true } },
        cerradoPor: { select: { id: true, nombre: true, apellido: true } },
      },
    });

    // Notificar al autor si quien cerró fue el líder
    if (!esAutor) {
      try {
        await this.notificaciones.crearNotificacionNovedadActualizada(
          novedad.empresaId,
          usuarioId,
          novedad.usuarioId,
          novedad.id,
          novedad.local.nombre,
          dto.estado,
        );
      } catch {
        // No interrumpir
      }
    }

    return actualizada;
  }
}
