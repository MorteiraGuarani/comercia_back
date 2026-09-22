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
import { Prisma } from '../../../generated/prisma/client';

@Injectable()
export class AvisoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificaciones: NotificacionService,
  ) {}

  private async colaboradoresActivos(
    liderId: number,
    empresaId: number,
  ): Promise<number[]> {
    const colaboradores = await this.prisma.usuario.findMany({
      where: {
        empresaId,
        superiorId: liderId,
        isActive: true,
        esSuperadmin: false,
      },
      select: { id: true },
    });
    return colaboradores.map((colaborador) => colaborador.id);
  }

  private async filtroRecibidos(
    usuarioId: number,
    empresaId: number,
  ): Promise<Prisma.AvisoCampoWhereInput> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { superiorId: true },
    });

    const destinatarios: Prisma.AvisoCampoWhereInput[] = [
      {
        destinatarioId: usuarioId,
        emisorId: { not: usuarioId },
      },
    ];

    if (usuario?.superiorId) {
      destinatarios.push({
        tipo: 'EQUIPO',
        emisorId: usuario.superiorId,
      });
    }

    return { empresaId, OR: destinatarios };
  }

  /**
   * Enviar aviso a un impulsador específico o a todo el equipo
   */
  async crear(
    usuarioId: number,
    empresaId: number,
    dto: CrearAvisoDto,
  ) {
    if (dto.tipo === 'INDIVIDUAL' && !dto.destinatarioId) {
      throw new BadRequestException('Debes especificar el destinatario del aviso');
    }

    const subordinados = await this.colaboradoresActivos(usuarioId, empresaId);

    if (dto.tipo === 'INDIVIDUAL') {
      if (!subordinados.includes(dto.destinatarioId!)) {
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
    } else if (subordinados.length === 0) {
      throw new ForbiddenException(
        'No tienes colaboradores activos para recibir el comunicado',
      );
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

    const subordinados = await this.colaboradoresActivos(usuarioId, empresaId);
    const subordinadosSet = new Set(subordinados);
    const totalSubordinados = subordinados.length;

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
        const lecturasDelEquipo = a.lecturas.filter((lectura) =>
          subordinadosSet.has(lectura.usuarioId),
        );
        return {
          id: a.id,
          tipo: a.tipo,
          mensaje: a.mensaje,
          destinatario: null,
          creadoAt: a.creadoAt,
          leidoPor: lecturasDelEquipo.length,
          total: totalSubordinados,
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

    const where = await this.filtroRecibidos(usuarioId, empresaId);

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
  async marcarLeido(usuarioId: number, empresaId: number, avisoId: number) {
    const aviso = await this.prisma.avisoCampo.findFirst({
      where: {
        id: avisoId,
        ...(await this.filtroRecibidos(usuarioId, empresaId)),
      },
      select: { id: true },
    });
    if (!aviso) {
      throw new ForbiddenException('No tienes acceso a este aviso');
    }

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
