import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { obtenerLiderDirecto } from '../utils/autorizacion';
import {
  ContadorNoLeidasDto,
  ListarNotificacionesDto,
  MarcarTodasLeidasDto,
  NotificacionDto,
} from '../dto/notificacion.dto';
import {
  rangoPaginacion,
  respuestaPaginada,
} from '../../common/utils/paginacion';
import {
  Prisma,
  TipoNotificacionCampo,
} from '../../../generated/prisma/client';

@Injectable()
export class NotificacionService {
  constructor(private prisma: PrismaService) {}

  /**
   * Crear notificación de comentario en tarea
   */
  async crearNotificacionComentario(
    empresaId: number,
    emisorId: number,
    comentarioId: number,
    nombreTarea: string,
  ): Promise<void> {
    // Obtener el líder directo del usuario emisor
    const liderId = await obtenerLiderDirecto(this.prisma, emisorId);

    if (!liderId) {
      // Si no tiene líder, no crear notificación
      return;
    }

    // Obtener datos del emisor para el mensaje
    const emisor = await this.prisma.usuario.findUnique({
      where: { id: emisorId },
      select: {
        nombre: true,
        apellido: true,
      },
    });

    if (!emisor) {
      return;
    }

    const titulo = 'Nuevo comentario en tarea';
    const mensaje = `${emisor.nombre} ${emisor.apellido} comentó en '${nombreTarea}'`;

    await this.prisma.notificacionCampo.create({
      data: {
        empresaId,
        usuarioDestinatarioId: liderId,
        usuarioEmisorId: emisorId,
        tipo: TipoNotificacionCampo.COMENTARIO_TAREA,
        referenciaId: comentarioId,
        titulo,
        mensaje,
      },
    });
  }

  /**
   * Crear notificación de foto subida (opcional, extensión futura)
   */
  async crearNotificacionFoto(
    empresaId: number,
    emisorId: number,
    fotoId: number,
    nombreTarea: string,
    momento: 'ANTES' | 'DESPUES',
  ): Promise<void> {
    const liderId = await obtenerLiderDirecto(this.prisma, emisorId);

    if (!liderId) {
      return;
    }

    const emisor = await this.prisma.usuario.findUnique({
      where: { id: emisorId },
      select: {
        nombre: true,
        apellido: true,
      },
    });

    if (!emisor) {
      return;
    }

    const titulo = 'Nueva foto en tarea';
    const mensaje = `${emisor.nombre} ${emisor.apellido} subió foto ${momento.toLowerCase()} en '${nombreTarea}'`;

    await this.prisma.notificacionCampo.create({
      data: {
        empresaId,
        usuarioDestinatarioId: liderId,
        usuarioEmisorId: emisorId,
        tipo: TipoNotificacionCampo.FOTO_SUBIDA,
        referenciaId: fotoId,
        titulo,
        mensaje,
      },
    });
  }

  /**
   * Crear notificación cuando un impulsador reporta una novedad
   */
  async crearNotificacionNovedad(
    empresaId: number,
    emisorId: number,
    novedadId: number,
    nombreLocal: string,
    tipoNovedad: string,
  ): Promise<void> {
    const liderId = await obtenerLiderDirecto(this.prisma, emisorId);
    if (!liderId) return;

    const emisor = await this.prisma.usuario.findUnique({
      where: { id: emisorId },
      select: { nombre: true, apellido: true },
    });
    if (!emisor) return;

    const titulo = `Nueva novedad: ${tipoNovedad.toLowerCase()}`;
    const mensaje = `${emisor.nombre} ${emisor.apellido} reportó una novedad en '${nombreLocal}'`;

    await this.prisma.notificacionCampo.create({
      data: {
        empresaId,
        usuarioDestinatarioId: liderId,
        usuarioEmisorId: emisorId,
        tipo: TipoNotificacionCampo.NOVEDAD_CREADA,
        referenciaId: novedadId,
        titulo,
        mensaje,
      },
    });
  }

  /**
   * Crear notificación cuando una novedad es cerrada o cancelada por el Team Leader
   */
  async crearNotificacionNovedadActualizada(
    empresaId: number,
    emisorId: number,
    destinatarioId: number,
    novedadId: number,
    nombreLocal: string,
    nuevoEstado: string,
  ): Promise<void> {
    const titulo = `Novedad ${nuevoEstado.toLowerCase()}`;
    const mensaje = `Tu novedad en '${nombreLocal}' fue marcada como ${nuevoEstado.toLowerCase()}`;

    await this.prisma.notificacionCampo.create({
      data: {
        empresaId,
        usuarioDestinatarioId: destinatarioId,
        usuarioEmisorId: emisorId,
        tipo: TipoNotificacionCampo.NOVEDAD_ACTUALIZADA,
        referenciaId: novedadId,
        titulo,
        mensaje,
      },
    });
  }

  /**
   * Crear notificación cuando un usuario recibe un aviso
   */
  async crearNotificacionAviso(
    empresaId: number,
    emisorId: number,
    destinatarioId: number,
    avisoId: number,
    mensajeAviso: string,
  ): Promise<void> {
    const emisor = await this.prisma.usuario.findUnique({
      where: { id: emisorId },
      select: { nombre: true, apellido: true },
    });
    const nombreEmisor = emisor ? `${emisor.nombre} ${emisor.apellido}` : 'Tu líder';

    const titulo = 'Nuevo aviso de supervisión';
    const preview = mensajeAviso.length > 80 ? `${mensajeAviso.slice(0, 77)}...` : mensajeAviso;
    const mensaje = `${nombreEmisor}: ${preview}`;

    await this.prisma.notificacionCampo.create({
      data: {
        empresaId,
        usuarioDestinatarioId: destinatarioId,
        usuarioEmisorId: emisorId,
        tipo: TipoNotificacionCampo.AVISO_RECIBIDO,
        referenciaId: avisoId,
        titulo,
        mensaje,
      },
    });
  }

  /**
   * Listar notificaciones del usuario (con paginación)
   */
  async listar(
    usuarioId: number,
    dto: ListarNotificacionesDto,
  ): Promise<{
    items: NotificacionDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { skip, take, page, limit } = rangoPaginacion(dto);

    const where: Prisma.NotificacionCampoWhereInput = {
      usuarioDestinatarioId: usuarioId,
      ...(dto.leido !== undefined ? { leido: dto.leido } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.notificacionCampo.findMany({
        where,
        skip,
        take,
        orderBy: { creadoAt: 'desc' },
        select: {
          id: true,
          tipo: true,
          titulo: true,
          mensaje: true,
          usuarioEmisor: {
            select: {
              id: true,
              nombre: true,
              apellido: true,
            },
          },
          creadoAt: true,
          leido: true,
          leidoAt: true,
          referenciaId: true,
        },
      }),
      this.prisma.notificacionCampo.count({ where }),
    ]);

    const notificaciones: NotificacionDto[] = items.map((item) => ({
      id: item.id,
      tipo: item.tipo,
      titulo: item.titulo,
      mensaje: item.mensaje,
      usuarioEmisor: item.usuarioEmisor,
      creadoAt: item.creadoAt,
      leido: item.leido,
      leidoAt: item.leidoAt ?? undefined,
      referenciaId: item.referenciaId ?? undefined,
    }));

    return respuestaPaginada(notificaciones, total, page, limit);
  }

  /**
   * Marcar notificación como leída
   */
  async marcarLeida(
    usuarioId: number,
    notificacionId: number,
  ): Promise<NotificacionDto> {
    const notificacion = await this.prisma.notificacionCampo.update({
      where: {
        id: notificacionId,
        usuarioDestinatarioId: usuarioId,
      },
      data: {
        leido: true,
        leidoAt: new Date(),
      },
      select: {
        id: true,
        tipo: true,
        titulo: true,
        mensaje: true,
        usuarioEmisor: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
          },
        },
        creadoAt: true,
        leido: true,
        leidoAt: true,
        referenciaId: true,
      },
    });

    return {
      id: notificacion.id,
      tipo: notificacion.tipo,
      titulo: notificacion.titulo,
      mensaje: notificacion.mensaje,
      usuarioEmisor: notificacion.usuarioEmisor,
      creadoAt: notificacion.creadoAt,
      leido: notificacion.leido,
      leidoAt: notificacion.leidoAt ?? undefined,
      referenciaId: notificacion.referenciaId ?? undefined,
    };
  }

  /**
   * Marcar todas las notificaciones del usuario como leídas
   */
  async marcarTodasLeidas(usuarioId: number): Promise<MarcarTodasLeidasDto> {
    const result = await this.prisma.notificacionCampo.updateMany({
      where: {
        usuarioDestinatarioId: usuarioId,
        leido: false,
      },
      data: {
        leido: true,
        leidoAt: new Date(),
      },
    });

    return {
      marcadas: result.count,
    };
  }

  /**
   * Obtener contador de notificaciones no leídas
   */
  async contadorNoLeidas(usuarioId: number): Promise<ContadorNoLeidasDto> {
    const count = await this.prisma.notificacionCampo.count({
      where: {
        usuarioDestinatarioId: usuarioId,
        leido: false,
      },
    });

    return {
      noLeidas: count,
    };
  }
}
