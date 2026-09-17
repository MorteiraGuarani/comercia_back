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
import { prepararEvidencia, tareaParaEvidencia } from '../utils/evidencia-tarea';

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

    // Verificar que el usuario es el dueño de la visita
    if (cumplimiento && cumplimiento.visita.usuarioId !== usuarioId) {
      throw new ForbiddenException(
        'Solo puedes comentar en tus propias tareas',
      );
    }
    let nombreTarea = cumplimiento?.nombreTarea;
    if (!cumplimiento) {
      const tarea = await tareaParaEvidencia(this.prisma, usuarioId, empresaId, visitaId, tareaId);
      await prepararEvidencia(this.prisma, visitaId, tareaId, tarea.nombre);
      nombreTarea = tarea.nombre;
    }

    // Crear el comentario
    const comentario = await this.prisma.comentarioTareaCampo.create({
      data: {
        cumplimientoVisitaId: visitaId,
        cumplimientoTareaId: tareaId,
        usuarioId,
        comentario: dto.comentario,
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

    // Crear notificación para el líder
    try {
      await this.notificacionService.crearNotificacionComentario(
        empresaId, usuarioId, comentario.id, nombreTarea!,
      );
    } catch {
      this.logger.warn('Comentario guardado; no se pudo generar su notificación');
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

    const comentarios = await this.prisma.comentarioTareaCampo.findMany({
      where: {
        cumplimientoVisitaId: visitaId,
        cumplimientoTareaId: tareaId,
      },
      orderBy: {
        creadoAt: 'asc',
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
