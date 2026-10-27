import { detalleTarea } from '../utils/version-tarea';
import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ComentarioTareaDto,
  CrearComentarioTareaDto,
} from '../dto/comentario-tarea.dto';
import { verificarAccesoCumplimiento, esLiderDe } from '../utils/autorizacion';
import { NotificacionService } from './notificacion.service';
import {
  prepararEvidencia,
  tareaParaEvidencia,
} from '../utils/evidencia-tarea';

@Injectable()
export class ComentarioService {
  private readonly logger = new Logger(ComentarioService.name);
  constructor(
    private prisma: PrismaService,
    private notificacionService: NotificacionService,
  ) {}

  /**
   * Crear comentario en una tarea completada
   */
  async crear(
    usuarioId: number,
    empresaId: number,
    visitaId: number,
    tareaId: number,
    dto: CrearComentarioTareaDto,
  ): Promise<ComentarioTareaDto> {
    if (dto.operacionId) {
      const anterior = await this.prisma.comentarioTareaCampo.findFirst({
        where: {
          operacionId: dto.operacionId,
          usuarioId,
          cumplimientoVisitaId: visitaId,
          cumplimientoTareaId: tareaId,
        },
        select: {
          id: true,
          comentario: true,
          usuario: { select: { id: true, nombre: true, apellido: true } },
          creadoAt: true,
          leidoPorLider: true,
          leidoAt: true,
        },
      });
      if (anterior)
        return { ...anterior, leidoAt: anterior.leidoAt ?? undefined };
    }
    // Verificar que el cumplimiento existe
    const cumplimiento = await this.prisma.cumplimientoCampo.findUnique({
      where: {
        visitaId_tareaId: {
          visitaId,
          tareaId,
        },
      },
      select: {
        nombreTarea: true,
        visita: {
          select: {
            usuarioId: true,
          },
        },
      },
    });

    // El dueño de la visita comenta y su líder responde en el mismo hilo.
    const respondeLider =
      !!cumplimiento &&
      cumplimiento.visita.usuarioId !== usuarioId &&
      (await esLiderDe(this.prisma, usuarioId, cumplimiento.visita.usuarioId));
    if (
      cumplimiento &&
      cumplimiento.visita.usuarioId !== usuarioId &&
      !respondeLider
    ) {
      throw new ForbiddenException(
        'Solo puedes comentar en tus propias tareas o en las de tu equipo',
      );
    }
    let nombreTarea = cumplimiento?.nombreTarea;
    if (!cumplimiento) {
      const tarea = await tareaParaEvidencia(
        this.prisma,
        usuarioId,
        empresaId,
        visitaId,
        tareaId,
      );
      await prepararEvidencia(
        this.prisma,
        visitaId,
        tareaId,
        tarea.nombre,
        tarea.version,
        detalleTarea(tarea),
      );
      nombreTarea = tarea.nombre;
    }

    await this.prisma.cumplimientoCampo.update({
      where: { visitaId_tareaId: { visitaId, tareaId } },
      data: { actividadEn: new Date() },
      select: { tareaId: true },
    });
    // Crear el comentario
    const comentario = await this.prisma.comentarioTareaCampo.create({
      data: {
        cumplimientoVisitaId: visitaId,
        cumplimientoTareaId: tareaId,
        usuarioId,
        comentario: dto.comentario,
        operacionId: dto.operacionId,
      },
      select: {
        id: true,
        comentario: true,
        usuario: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
          },
        },
        creadoAt: true,
        leidoPorLider: true,
        leidoAt: true,
      },
    });

    // Comenta el dueño: avisa a sus líderes. Responde un líder: avisa al dueño (y a sus otros líderes).
    try {
      if (respondeLider)
        await this.notificacionService.crearNotificacionRespuestaComentario(
          empresaId,
          usuarioId,
          cumplimiento.visita.usuarioId,
          comentario.id,
          nombreTarea!,
        );
      else
        await this.notificacionService.crearNotificacionComentario(
          empresaId,
          usuarioId,
          comentario.id,
          nombreTarea!,
        );
    } catch {
      this.logger.warn(
        'Comentario guardado; no se pudo generar su notificación',
      );
    }

    return {
      id: comentario.id,
      comentario: comentario.comentario,
      usuario: comentario.usuario,
      creadoAt: comentario.creadoAt,
      leidoPorLider: comentario.leidoPorLider,
      leidoAt: comentario.leidoAt ?? undefined,
    };
  }

  /**
   * Dónde está un comentario (visita y tarea) para abrir su hilo desde la
   * notificación. Lo ve quien puede ver ese hilo: el dueño o su líder.
   */
  async ubicar(usuarioId: number, comentarioId: number) {
    const comentario = await this.prisma.comentarioTareaCampo.findUnique({
      where: { id: comentarioId },
      select: {
        cumplimientoVisitaId: true,
        cumplimientoTareaId: true,
        cumplimiento: { select: { visita: { select: { usuarioId: true } } } },
      },
    });
    if (!comentario) throw new NotFoundException('Comentario no encontrado');
    await verificarAccesoCumplimiento(
      this.prisma,
      usuarioId,
      comentario.cumplimientoVisitaId,
      comentario.cumplimientoTareaId,
    );
    return {
      visitaId: comentario.cumplimientoVisitaId,
      tareaId: comentario.cumplimientoTareaId,
      esPropia: comentario.cumplimiento.visita.usuarioId === usuarioId,
    };
  }

  /**
   * Listar comentarios de una tarea completada
   */
  async listar(
    usuarioId: number,
    visitaId: number,
    tareaId: number,
  ): Promise<ComentarioTareaDto[]> {
    // Verificar acceso (debe ser dueño o líder)
    await verificarAccesoCumplimiento(
      this.prisma,
      usuarioId,
      visitaId,
      tareaId,
    );

    // Los 50 más recientes, devueltos en orden cronológico.
    const recientes = await this.prisma.comentarioTareaCampo.findMany({
      where: {
        cumplimientoVisitaId: visitaId,
        cumplimientoTareaId: tareaId,
      },
      orderBy: [{ creadoAt: 'desc' }, { id: 'desc' }],
      take: 50,
      select: {
        id: true,
        comentario: true,
        usuario: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
          },
        },
        creadoAt: true,
        leidoPorLider: true,
        leidoAt: true,
      },
    });
    const comentarios = recientes.reverse();

    return comentarios.map((c) => ({
      id: c.id,
      comentario: c.comentario,
      usuario: c.usuario,
      creadoAt: c.creadoAt,
      leidoPorLider: c.leidoPorLider,
      leidoAt: c.leidoAt ?? undefined,
    }));
  }

  /**
   * Marcar comentario como leído por líder
   */
  async marcarLeido(
    usuarioId: number,
    comentarioId: number,
  ): Promise<ComentarioTareaDto> {
    // Obtener el comentario
    const comentario = await this.prisma.comentarioTareaCampo.findUnique({
      where: { id: comentarioId },
      select: {
        id: true,
        comentario: true,
        usuario: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
          },
        },
        usuarioId: true,
        creadoAt: true,
        leidoPorLider: true,
        leidoAt: true,
      },
    });

    if (!comentario) {
      throw new NotFoundException('Comentario no encontrado');
    }

    // Verificar que el usuario es líder del que escribió el comentario
    const esLider = await esLiderDe(
      this.prisma,
      usuarioId,
      comentario.usuarioId,
    );

    if (!esLider) {
      throw new ForbiddenException(
        'Solo el líder del usuario puede marcar como leído',
      );
    }

    // Marcar como leído
    const actualizado = await this.prisma.comentarioTareaCampo.update({
      where: { id: comentarioId },
      data: {
        leidoPorLider: true,
        leidoAt: new Date(),
      },
      select: {
        id: true,
        comentario: true,
        usuario: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
          },
        },
        creadoAt: true,
        leidoPorLider: true,
        leidoAt: true,
      },
    });

    return {
      id: actualizado.id,
      comentario: actualizado.comentario,
      usuario: actualizado.usuario,
      creadoAt: actualizado.creadoAt,
      leidoPorLider: actualizado.leidoPorLider,
      leidoAt: actualizado.leidoAt ?? undefined,
    };
  }

  /**
   * Contar comentarios no leídos de un cumplimiento
   */
  async contarNoLeidos(visitaId: number, tareaId: number): Promise<number> {
    return this.prisma.comentarioTareaCampo.count({
      where: {
        cumplimientoVisitaId: visitaId,
        cumplimientoTareaId: tareaId,
        leidoPorLider: false,
      },
    });
  }
}
