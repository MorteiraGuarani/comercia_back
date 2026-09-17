import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificacionService } from './notificacion.service';
import { CrearAvisoDto } from '../dto/aviso.dto';
import { ConsultaCampoDto } from '../dto/campo.dto';
import {
  rangoPaginacion,
  respuestaPaginada,
} from '../../common/utils/paginacion';
import { obtenerEquipoCompleto } from '../utils/autorizacion';

@Injectable()
export class AvisoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificaciones: NotificacionService,
  ) {}

  /**
   * Enviar aviso a un impulsador específico o a todo el equipo
   */
  async crear(
    usuarioId: number,
    empresaId: number,
    dto: CrearAvisoDto,
  ) {
    const equipoIds = await obtenerEquipoCompleto(this.prisma, usuarioId);
    const subordinados = equipoIds.filter((id) => id !== usuarioId);

    if (dto.tipo === 'INDIVIDUAL') {
      if (!dto.destinatarioId) {
        throw new BadRequestException('Debés especificar el destinatario del aviso');
      }
      if (!subordinados.includes(dto.destinatarioId) && subordinados.length > 0) {
        throw new ForbiddenException('El destinatario no pertenece a tu equipo');
      }

      // Validar que el destinatario existe en la empresa
      const dest = await this.prisma.usuario.findFirst({
        where: { id: dto.destinatarioId, empresaId, isActive: true },
        select: { id: true },
      });
      if (!dest) {
        throw new NotFoundException('Destinatario no encontrado o inactivo');
      }
    }

    const aviso = await this.prisma.avisoCampo.create({
      data: {
        empresaId,
        emisorId: usuarioId,
        tipo: dto.tipo,
        destinatarioId: dto.tipo === 'INDIVIDUAL' ? dto.destinatarioId : null,
        mensaje: dto.mensaje.trim(),
      },
      include: {
        emisor: { select: { id: true, nombre: true, apellido: true } },
        destinatario: { select: { id: true, nombre: true, apellido: true } },
      },
    });

    // Enviar notificaciones correspondientes
    try {
      if (dto.tipo === 'INDIVIDUAL' && dto.destinatarioId) {
        await this.notificaciones.crearNotificacionAviso(
          empresaId,
          usuarioId,
          dto.destinatarioId,
          aviso.id,
          aviso.mensaje,
        );
      } else {
        // Para todo el equipo
        for (const miembroId of subordinados) {
          await this.notificaciones.crearNotificacionAviso(
            empresaId,
            usuarioId,
            miembroId,
            aviso.id,
            aviso.mensaje,
          );
        }
      }
    } catch {
      // Continuar si la notificación falla
    }

    return aviso;
  }

  /**
   * Listar avisos enviados por el supervisor con métricas de lectura
   */
  async listarEnviados(
    usuarioId: number,
    empresaId: number,
    query: ConsultaCampoDto,
  ) {
    const { skip, take, page, limit } = rangoPaginacion(query);
    const where = { empresaId, emisorId: usuarioId };

    const equipoIds = await obtenerEquipoCompleto(this.prisma, usuarioId);
    const totalSubordinados = equipoIds.filter((id) => id !== usuarioId).length;

    const [items, total] = await Promise.all([
      this.prisma.avisoCampo.findMany({
        where,
        include: {
          destinatario: { select: { id: true, nombre: true, apellido: true } },
          lecturas: { select: { usuarioId: true, leidoAt: true } },
        },
        orderBy: { creadoAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.avisoCampo.count({ where }),
    ]);

    const itemsConLectura = items.map((a) => {
      if (a.tipo === 'INDIVIDUAL') {
        const lectura = a.lecturas.find((l) => l.usuarioId === a.destinatarioId);
        return {
          id: a.id,
          tipo: a.tipo,
          mensaje: a.mensaje,
          destinatario: a.destinatario,
          creadoAt: a.creadoAt,
          leido: !!lectura,
          leidoAt: lectura?.leidoAt ?? null,
        };
      } else {
        return {
          id: a.id,
          tipo: a.tipo,
          mensaje: a.mensaje,
          destinatario: null,
          creadoAt: a.creadoAt,
          leidoPor: a.lecturas.length,
          total: totalSubordinados || a.lecturas.length || 1,
        };
      }
    });

    return respuestaPaginada(itemsConLectura, total, page, limit);
  }

  /**
   * Listar avisos recibidos por el usuario actual
   */
  async listarRecibidos(
    usuarioId: number,
    empresaId: number,
    query: ConsultaCampoDto,
  ) {
    const { skip, take, page, limit } = rangoPaginacion(query);

    // Obtener superior directo si existe
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { superiorId: true },
    });

    const where = {
      empresaId,
      OR: [
        { destinatarioId: usuarioId },
        {
          tipo: 'EQUIPO' as const,
          ...(usuario?.superiorId ? { emisorId: usuario.superiorId } : {}),
        },
      ],
    };

    const [items, total] = await Promise.all([
      this.prisma.avisoCampo.findMany({
        where,
        include: {
          emisor: { select: { id: true, nombre: true, apellido: true } },
          lecturas: {
            where: { usuarioId },
            select: { leidoAt: true },
          },
        },
        orderBy: { creadoAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.avisoCampo.count({ where }),
    ]);

    const formated = items.map((a) => ({
      id: a.id,
      tipo: a.tipo,
      mensaje: a.mensaje,
      emisor: a.emisor,
      creadoAt: a.creadoAt,
      leido: a.lecturas.length > 0,
      leidoAt: a.lecturas[0]?.leidoAt ?? null,
    }));

    return respuestaPaginada(formated, total, page, limit);
  }

  /**
   * Marcar aviso como leído por el usuario
   */
  async marcarLeido(usuarioId: number, avisoId: number) {
    const lectura = await this.prisma.avisoLecturaCampo.upsert({
      where: {
        avisoId_usuarioId: {
          avisoId,
          usuarioId,
        },
      },
      create: {
        avisoId,
        usuarioId,
      },
      update: {
        leidoAt: new Date(),
      },
    });

    return { ok: true, leidoAt: lectura.leidoAt };
  }
}
