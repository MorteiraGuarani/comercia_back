import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { resolve } from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { ConsultaAvisosDto, CrearAvisoDto } from '../dto/aviso.dto';
import { ConsultaCampoDto } from '../dto/campo.dto';
import {
  rangoPaginacion,
  respuestaPaginada,
} from '../../common/utils/paginacion';
import {
  Prisma,
  TipoNotificacionCampo,
} from '../../../generated/prisma/client';
import { AdjuntoCampoService } from './adjunto-campo.service';
import { siguienteAviso } from '../utils/programacion-aviso';
import { validarArchivoImagen } from '../utils/multer-config';

const adjuntosSelect = {
  select: {
    id: true,
    nombreOriginal: true,
    mimeType: true,
    tamanioBytes: true,
    creadoAt: true,
  },
  orderBy: { creadoAt: 'asc' as const },
};
const personaSelect = { id: true, nombre: true, apellido: true } as const;

@Injectable()
export class AvisoService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AvisoService.name);
  private temporizador?: ReturnType<typeof setInterval>;
  private procesando = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly adjuntos: AdjuntoCampoService,
  ) {}

  onModuleInit() {
    this.temporizador = setInterval(
      () => void this.procesarProgramaciones(),
      30_000,
    );
    void this.procesarProgramaciones();
  }

  onModuleDestroy() {
    if (this.temporizador) clearInterval(this.temporizador);
  }

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
    return colaboradores.map((item) => item.id);
  }

  private idsSeleccionados(dto: CrearAvisoDto): number[] {
    if (dto.tipo === 'INDIVIDUAL')
      return dto.destinatarioId ? [dto.destinatarioId] : [];
    if (dto.tipo === 'EQUIPO') return [];
    const ids =
      dto.destinatariosIds?.split(',').map((id) => Number(id.trim())) ?? [];
    if (
      !ids.length ||
      ids.length > 500 ||
      ids.some((id) => !Number.isSafeInteger(id) || id < 1) ||
      new Set(ids).size !== ids.length
    ) {
      throw new BadRequestException(
        'Selecciona uno o varios destinatarios válidos',
      );
    }
    return ids;
  }

  private async destinatariosValidos(
    usuarioId: number,
    empresaId: number,
    dto: CrearAvisoDto,
  ) {
    const subordinados = await this.colaboradoresActivos(usuarioId, empresaId);
    const seleccionados = this.idsSeleccionados(dto);
    if (
      dto.tipo !== 'EQUIPO' &&
      (!seleccionados.length ||
        seleccionados.some((id) => !subordinados.includes(id)))
    ) {
      throw new ForbiddenException(
        'Los destinatarios deben pertenecer a tu equipo activo',
      );
    }
    if (dto.tipo === 'EQUIPO' && !subordinados.length) {
      throw new ForbiddenException(
        'No tienes colaboradores activos para recibir el comunicado',
      );
    }
    return dto.tipo === 'EQUIPO' ? subordinados : seleccionados;
  }

  private async publicar(
    tx: Prisma.TransactionClient,
    empresaId: number,
    emisorId: number,
    tipo: CrearAvisoDto['tipo'],
    mensaje: string,
    destinatariosIds: number[],
    programacionId?: number,
    instanteProgramado?: Date,
    adjuntosOrigen: {
      nombreOriginal: string;
      rutaArchivo: string;
      mimeType: string;
      tamanioBytes: number;
    }[] = [],
  ) {
    const emisor = await tx.usuario.findUnique({
      where: { id: emisorId },
      select: personaSelect,
    });
    const aviso = await tx.avisoCampo.create({
      data: {
        empresaId,
        emisorId,
        tipo,
        mensaje,
        destinatarioId: tipo === 'INDIVIDUAL' ? destinatariosIds[0] : null,
        programacionId,
        instanteProgramado,
        destinatarios: {
          create: destinatariosIds.map((usuarioId) => ({ usuarioId })),
        },
      },
      select: {
        id: true,
        tipo: true,
        mensaje: true,
        creadoAt: true,
        emisor: { select: personaSelect },
        destinatario: { select: personaSelect },
      },
    });
    if (adjuntosOrigen.length) {
      await tx.adjuntoCampo.createMany({
        data: adjuntosOrigen.map((archivo) => ({
          empresaId,
          usuarioId: emisorId,
          avisoId: aviso.id,
          ...archivo,
        })),
      });
    }
    const preview =
      mensaje.length > 80 ? `${mensaje.slice(0, 77)}...` : mensaje;
    await tx.notificacionCampo.createMany({
      data: destinatariosIds.map((usuarioDestinatarioId) => ({
        empresaId,
        usuarioDestinatarioId,
        usuarioEmisorId: emisorId,
        tipo: TipoNotificacionCampo.AVISO_RECIBIDO,
        referenciaId: aviso.id,
        titulo: 'Nuevo aviso de supervisión',
        mensaje:
          `${emisor?.nombre ?? 'Tu líder'} ${emisor?.apellido ?? ''}: ${preview}`.slice(
            0,
            250,
          ),
      })),
    });
    const adjuntos = await tx.adjuntoCampo.findMany({
      where: { avisoId: aviso.id },
      ...adjuntosSelect,
    });
    return { ...aviso, adjuntos };
  }

  async crear(
    usuarioId: number,
    empresaId: number,
    dto: CrearAvisoDto,
    archivos: Express.Multer.File[] = [],
  ) {
    try {
      if (dto.mensaje.trim().length < 2)
        throw new BadRequestException(
          'El aviso debe tener al menos 2 caracteres',
        );
      archivos.forEach(validarArchivoImagen);
      const destinatariosIds = await this.destinatariosValidos(
        usuarioId,
        empresaId,
        dto,
      );
      const metadatos = archivos.map((archivo) => ({
        nombreOriginal: archivo.originalname.slice(0, 255),
        rutaArchivo: resolve(archivo.path),
        mimeType: archivo.mimetype,
        tamanioBytes: archivo.size,
      }));
      if (dto.frecuencia) {
        if (!dto.fechaInicio || !dto.hora)
          throw new BadRequestException('Indica fecha y hora del primer envío');
        const diasSemana =
          dto.diasSemana?.split(',').filter(Boolean).map(Number) ?? [];
        const regla = {
          frecuencia: dto.frecuencia,
          fechaInicio: dto.fechaInicio,
          hora: dto.hora,
          intervaloHoras: dto.intervaloHoras,
          diasSemana,
          diaMes: dto.diaMes,
          fechaFin: dto.fechaFin,
        };
        const proximoEnvioAt = siguienteAviso(regla, new Date());
        if (!proximoEnvioAt)
          throw new BadRequestException('El próximo envío debe ser futuro');
        const programacion = await this.prisma.avisoProgramacionCampo.create({
          data: {
            empresaId,
            emisorId: usuarioId,
            tipo: dto.tipo,
            destinatariosIds: dto.tipo === 'EQUIPO' ? [] : destinatariosIds,
            mensaje: dto.mensaje.trim(),
            ...regla,
            proximoEnvioAt,
            adjuntos: {
              create: metadatos.map((archivo) => ({
                empresaId,
                usuarioId,
                ...archivo,
              })),
            },
          },
          select: { id: true, proximoEnvioAt: true },
        });
        return { programacion };
      }
      const aviso = await this.prisma.$transaction((tx) =>
        this.publicar(
          tx,
          empresaId,
          usuarioId,
          dto.tipo,
          dto.mensaje.trim(),
          destinatariosIds,
          undefined,
          undefined,
          metadatos,
        ),
      );
      return aviso;
    } catch (error) {
      this.adjuntos.descartarArchivos(archivos);
      throw error;
    }
  }

  private async procesarProgramaciones() {
    if (this.procesando) return;
    this.procesando = true;
    try {
      const pendientes = await this.prisma.avisoProgramacionCampo.findMany({
        where: { activo: true, proximoEnvioAt: { lte: new Date() } },
        select: { id: true },
        orderBy: { proximoEnvioAt: 'asc' },
        take: 20,
      });
      for (const pendiente of pendientes) {
        try {
          await this.prisma.$transaction(async (tx) => {
            const programacion = await tx.avisoProgramacionCampo.findUnique({
              where: { id: pendiente.id },
              include: {
                adjuntos: {
                  select: {
                    nombreOriginal: true,
                    rutaArchivo: true,
                    mimeType: true,
                    tamanioBytes: true,
                  },
                },
              },
            });
            if (
              !programacion ||
              !programacion.activo ||
              programacion.proximoEnvioAt > new Date()
            )
              return;
            const siguiente = siguienteAviso(programacion, new Date());
            const reserva = await tx.avisoProgramacionCampo.updateMany({
              where: {
                id: programacion.id,
                activo: true,
                proximoEnvioAt: programacion.proximoEnvioAt,
              },
              data: {
                proximoEnvioAt: siguiente ?? programacion.proximoEnvioAt,
                activo: !!siguiente,
                ultimoEnvioAt: new Date(),
              },
            });
            if (!reserva.count) return;
            const emisor = await tx.usuario.findUnique({
              where: { id: programacion.emisorId },
              select: { isActive: true },
            });
            if (!emisor?.isActive) {
              await tx.avisoProgramacionCampo.update({
                where: { id: programacion.id },
                data: { activo: false },
              });
              return;
            }
            const destinatarios = await tx.usuario.findMany({
              where: {
                empresaId: programacion.empresaId,
                superiorId: programacion.emisorId,
                isActive: true,
                esSuperadmin: false,
                ...(programacion.tipo === 'EQUIPO'
                  ? {}
                  : { id: { in: programacion.destinatariosIds } }),
              },
              select: { id: true },
            });
            if (!destinatarios.length) return;
            await this.publicar(
              tx,
              programacion.empresaId,
              programacion.emisorId,
              programacion.tipo,
              programacion.mensaje,
              destinatarios.map((item) => item.id),
              programacion.id,
              programacion.proximoEnvioAt,
              programacion.adjuntos,
            );
          });
        } catch (error) {
          this.logger.error(
            `No se pudo enviar el aviso programado ${pendiente.id}`,
            error,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        'No se pudieron consultar los avisos programados',
        error,
      );
    } finally {
      this.procesando = false;
    }
  }

  async listarDestinatarios(
    usuarioId: number,
    empresaId: number,
    query: ConsultaAvisosDto,
  ) {
    const { skip, take, page, limit } = rangoPaginacion(query);
    const where: Prisma.UsuarioWhereInput = {
      empresaId,
      superiorId: usuarioId,
      isActive: true,
      esSuperadmin: false,
      ...(query.buscar?.trim()
        ? {
            OR: [
              {
                nombre: { contains: query.buscar.trim(), mode: 'insensitive' },
              },
              {
                apellido: {
                  contains: query.buscar.trim(),
                  mode: 'insensitive',
                },
              },
              {
                correo: { contains: query.buscar.trim(), mode: 'insensitive' },
              },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.usuario.findMany({
        where,
        select: { id: true, nombre: true, apellido: true },
        orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
        skip,
        take,
      }),
      this.prisma.usuario.count({ where }),
    ]);
    return respuestaPaginada(
      items.map((item) => ({
        id: item.id,
        nombre: `${item.nombre} ${item.apellido}`.trim(),
      })),
      total,
      page,
      limit,
    );
  }

  async listarProgramaciones(
    usuarioId: number,
    empresaId: number,
    query: ConsultaAvisosDto,
  ) {
    const { skip, take, page, limit } = rangoPaginacion(query);
    const where = { emisorId: usuarioId, empresaId };
    const [items, total] = await Promise.all([
      this.prisma.avisoProgramacionCampo.findMany({
        where,
        select: {
          id: true,
          tipo: true,
          mensaje: true,
          frecuencia: true,
          fechaInicio: true,
          hora: true,
          intervaloHoras: true,
          diasSemana: true,
          diaMes: true,
          fechaFin: true,
          proximoEnvioAt: true,
          ultimoEnvioAt: true,
          activo: true,
          creadoAt: true,
          destinatariosIds: true,
        },
        orderBy: { creadoAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.avisoProgramacionCampo.count({ where }),
    ]);
    return respuestaPaginada(items, total, page, limit);
  }

  async cancelarProgramacion(usuarioId: number, empresaId: number, id: number) {
    const result = await this.prisma.avisoProgramacionCampo.updateMany({
      where: { id, emisorId: usuarioId, empresaId, activo: true },
      data: { activo: false },
    });
    if (!result.count)
      throw new NotFoundException('Programación activa no encontrada');
    return { ok: true };
  }

  private async filtroRecibidos(
    usuarioId: number,
    empresaId: number,
  ): Promise<Prisma.AvisoCampoWhereInput> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { superiorId: true },
    });
    const legado: Prisma.AvisoCampoWhereInput[] = [
      { destinatarioId: usuarioId },
    ];
    if (usuario?.superiorId)
      legado.push({ tipo: 'EQUIPO', emisorId: usuario.superiorId });
    return {
      empresaId,
      emisorId: { not: usuarioId },
      OR: [
        { destinatarios: { some: { usuarioId } } },
        { destinatarios: { none: {} }, OR: legado },
      ],
    };
  }

  async listarEnviados(
    usuarioId: number,
    empresaId: number,
    query: ConsultaCampoDto,
  ) {
    const { skip, take, page, limit } = rangoPaginacion(query);
    const where = { empresaId, emisorId: usuarioId };
    const subordinados = await this.colaboradoresActivos(usuarioId, empresaId);
    const [items, total] = await Promise.all([
      this.prisma.avisoCampo.findMany({
        where,
        include: {
          destinatario: { select: personaSelect },
          destinatarios: {
            select: { usuarioId: true, usuario: { select: personaSelect } },
          },
          lecturas: { select: { usuarioId: true, leidoAt: true } },
          adjuntos: adjuntosSelect,
        },
        orderBy: { creadoAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.avisoCampo.count({ where }),
    ]);
    const respuesta = items.map((aviso) => {
      const ids = aviso.destinatarios.length
        ? aviso.destinatarios.map((item) => item.usuarioId)
        : aviso.tipo === 'INDIVIDUAL'
          ? [aviso.destinatarioId].filter((id): id is number => id !== null)
          : subordinados;
      const lectura = aviso.lecturas.find(
        (item) => item.usuarioId === aviso.destinatarioId,
      );
      return {
        id: aviso.id,
        tipo: aviso.tipo,
        mensaje: aviso.mensaje,
        destinatario: aviso.destinatario,
        destinatarios: aviso.destinatarios.map((item) => item.usuario),
        creadoAt: aviso.creadoAt,
        adjuntos: aviso.adjuntos,
        leido: !!lectura,
        leidoAt: lectura?.leidoAt ?? null,
        leidoPor: aviso.lecturas.filter((item) => ids.includes(item.usuarioId))
          .length,
        total: ids.length,
      };
    });
    return respuestaPaginada(respuesta, total, page, limit);
  }

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
          emisor: { select: personaSelect },
          lecturas: { where: { usuarioId }, select: { leidoAt: true } },
          adjuntos: adjuntosSelect,
        },
        orderBy: { creadoAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.avisoCampo.count({ where }),
    ]);
    return respuestaPaginada(
      items.map((aviso) => ({
        id: aviso.id,
        tipo: aviso.tipo,
        mensaje: aviso.mensaje,
        emisor: aviso.emisor,
        creadoAt: aviso.creadoAt,
        leido: !!aviso.lecturas.length,
        leidoAt: aviso.lecturas[0]?.leidoAt ?? null,
        adjuntos: aviso.adjuntos,
      })),
      total,
      page,
      limit,
    );
  }

  async obtenerPorId(usuarioId: number, empresaId: number, id: number) {
    const aviso = await this.prisma.avisoCampo.findFirst({
      where: {
        id,
        empresaId,
        OR: [
          { emisorId: usuarioId },
          await this.filtroRecibidos(usuarioId, empresaId),
        ],
      },
      include: {
        emisor: { select: personaSelect },
        destinatario: { select: personaSelect },
        adjuntos: adjuntosSelect,
        lecturas: { where: { usuarioId }, select: { leidoAt: true } },
      },
    });
    if (!aviso) throw new NotFoundException('Aviso no encontrado');
    return {
      id: aviso.id,
      tipo: aviso.tipo,
      mensaje: aviso.mensaje,
      emisor: aviso.emisor,
      destinatario: aviso.destinatario,
      creadoAt: aviso.creadoAt,
      adjuntos: aviso.adjuntos,
      leido: !!aviso.lecturas.length,
      leidoAt: aviso.lecturas[0]?.leidoAt ?? null,
    };
  }

  async marcarLeido(usuarioId: number, empresaId: number, avisoId: number) {
    const aviso = await this.prisma.avisoCampo.findFirst({
      where: {
        id: avisoId,
        ...(await this.filtroRecibidos(usuarioId, empresaId)),
      },
      select: { id: true },
    });
    if (!aviso) throw new ForbiddenException('No tienes acceso a este aviso');
    const lectura = await this.prisma.avisoLecturaCampo.upsert({
      where: { avisoId_usuarioId: { avisoId, usuarioId } },
      create: { avisoId, usuarioId },
      update: { leidoAt: new Date() },
    });
    return { ok: true, leidoAt: lectura.leidoAt };
  }
}
