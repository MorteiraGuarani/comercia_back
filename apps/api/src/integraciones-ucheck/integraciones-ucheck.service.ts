import { cargarToleranciasAgenda } from '../tolerancias/utils/cargar-tolerancias';
import {
  evaluarMarcaHorario,
  heredarTolerancias,
} from '../tolerancias/utils/tolerancia-horario';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { CampoAccesoService } from '../campo/campo-acceso.service';
import { JornadaCampoService } from '../campo/jornada-campo.service';
import { obtenerItinerarioHeredado } from '../campo/utils/autorizacion';
import { PrismaService } from '../prisma/prisma.service';
import { AgendaUcheckDto } from './dto/agenda-ucheck.dto';
import { MarcacionUcheckDto } from './dto/marcacion-ucheck.dto';
import { SeguimientoUcheckDto } from './dto/seguimiento-ucheck.dto';
import {
  destinatarioCampo,
  rolDelEquipoCampo,
  exigirEquipoCampo,
  EQUIPO_CAMPO_SELECT,
} from '../campo/utils/equipo-campo';

function correoNormalizado(correo: string) {
  return correo.trim().toLowerCase();
}

function fechaSql(fecha: string) {
  const resultado = new Date(`${fecha}T00:00:00.000Z`);
  if (
    !Number.isFinite(resultado.getTime()) ||
    resultado.toISOString().slice(0, 10) !== fecha
  )
    throw new BadRequestException('Fecha inválida');
  return resultado;
}

@Injectable()
export class IntegracionesUcheckService {
  private readonly logger = new Logger(IntegracionesUcheckService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accesoCampo: CampoAccesoService,
    private readonly jornadaCampo: JornadaCampoService,
  ) {}

  private async usuarioPorCorreo(correo: string, ucheckUsuarioId?: number) {
    const vinculo = ucheckUsuarioId
      ? await this.prisma.identidadUcheck.findUnique({
          where: { ucheckUsuarioId },
          select: { usuarioId: true },
        })
      : null;
    const usuario = await this.prisma.usuario.findFirst({
      where: {
        ...(vinculo
          ? { id: vinculo.usuarioId }
          : {
              correo: {
                equals: correoNormalizado(correo),
                mode: 'insensitive' as const,
              },
            }),
        isActive: true,
        esSuperadmin: false,
      },
      select: {
        id: true,
        empresaId: true,
        correo: true,
        permitirVinculoAutomatico: true,
        nombre: true,
        apellido: true,
        rol: {
          select: {
            descripcion: true,
            equipoCampo: { select: EQUIPO_CAMPO_SELECT },
          },
        },
        empresa: { select: { id: true, nombre: true } },
      },
    });
    if (!usuario)
      throw new NotFoundException(
        'El correo no corresponde a un usuario activo de Comercia',
      );
    if (
      ucheckUsuarioId &&
      !vinculo &&
      usuario.permitirVinculoAutomatico === false
    )
      throw new ConflictException(
        'El administrador debe vincular esta cuenta con Ucheck',
      );
    await this.accesoCampo.ejecutar(usuario.id);
    return usuario;
  }

  async agenda(query: AgendaUcheckDto) {
    const usuario = await this.usuarioPorCorreo(
      query.correo,
      query.ucheckUsuarioId,
    );
    const pagina = await this.jornadaCampo.agenda(usuario.id, {
      fecha: query.fecha,
      page: query.page,
      limit: query.limit,
    });
    const tolerancias = await cargarToleranciasAgenda(
      this.prisma,
      usuario.empresaId,
      usuario.id,
      pagina.items.flatMap((a) => a.local.horarios.map((h) => h.id)),
    );
    return {
      usuario: {
        id: usuario.id,
        correo: correoNormalizado(usuario.correo),
        nombre: `${usuario.nombre} ${usuario.apellido}`.trim(),
      },
      empresa: usuario.empresa,
      ...pagina,
      items: pagina.items.map((a) => ({
        ...a,
        local: {
          ...a.local,
          horarios: a.local.horarios.map((h) => ({
            ...h,
            tolerancias: tolerancias.get(h.id),
          })),
        },
      })),
    };
  }

  async registrarSeguimiento(dto: SeguimientoUcheckDto) {
    const reportadaEn = new Date(dto.reportadaEn);
    if (reportadaEn.getTime() > Date.now() + 15000)
      throw new BadRequestException('Fecha de seguimiento inválida');
    const vinculo = await this.prisma.identidadUcheck.findUnique({
      where: { ucheckUsuarioId: dto.ucheckUsuarioId },
      select: { usuarioId: true },
    });
    const usuario = vinculo
      ? await this.prisma.usuario.findFirst({
          where: { id: vinculo.usuarioId, isActive: true, esSuperadmin: false },
          select: { id: true },
        })
      : await this.usuarioPorCorreo(dto.correo);
    if (!usuario) throw new NotFoundException('Cuenta de campo no disponible');
    await this.accesoCampo.ejecutar(usuario.id);
    if (
      dto.activo &&
      (dto.latitud == null ||
        dto.longitud == null ||
        dto.precisionMetros == null ||
        !dto.capturadaEn)
    )
      throw new BadRequestException('Faltan datos de ubicación');
    const resultado = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM usuarios WHERE id = ${usuario.id} FOR UPDATE`;
      {
        const permiso = await tx.usuario.findUnique({
          where: { id: usuario.id },
          select: { permitirVinculoAutomatico: true },
        });
        const existente = await tx.identidadUcheck.findUnique({
          where: { usuarioId: usuario.id },
          select: { ucheckUsuarioId: true },
        });
        if (existente && existente.ucheckUsuarioId !== dto.ucheckUsuarioId)
          throw new ConflictException(
            'La cuenta ya está vinculada a otra identidad',
          );
        if (!existente && !permiso?.permitirVinculoAutomatico)
          throw new ConflictException(
            'El administrador debe vincular esta cuenta con Ucheck',
          );
        if (!existente)
          await tx.identidadUcheck.create({
            data: {
              usuarioId: usuario.id,
              ucheckUsuarioId: dto.ucheckUsuarioId,
              correoVinculado: correoNormalizado(dto.correo),
            },
          });
      }
      const anterior = await tx.seguimientoCampo.findUnique({
        where: { usuarioId: usuario.id },
        select: { reportadaEn: true },
      });
      if (anterior && anterior.reportadaEn >= reportadaEn)
        return { ok: true, omitida: true };
      const data = {
        jornadaId: dto.jornadaId,
        activo: dto.activo,
        iniciadaEn: new Date(dto.iniciadaEn),
        reportadaEn,
        recibidaEn: new Date(),
        latitud: dto.activo ? dto.latitud : null,
        longitud: dto.activo ? dto.longitud : null,
        precisionMetros: dto.activo ? dto.precisionMetros : null,
        capturadaEn: dto.activo ? new Date(dto.capturadaEn!) : null,
      };
      await tx.seguimientoCampo.upsert({
        where: { usuarioId: usuario.id },
        create: { usuarioId: usuario.id, ...data },
        update: data,
        select: { usuarioId: true },
      });
      return { ok: true };
    });
    return resultado;
  }

  async registrarMarcacion(dto: MarcacionUcheckDto) {
    const repetido = await this.prisma.integracionUcheckEvento.findFirst({
      where: {
        OR: [
          { id: dto.eventoId },
          { ucheckJornadaId: dto.ucheckJornadaId, tipo: dto.tipo },
        ],
      },
      select: { id: true, visitaId: true },
    });
    if (repetido)
      return {
        ok: true,
        duplicado: true,
        eventoId: repetido.id,
        visitaId: repetido.visitaId,
      };

    const usuario = await this.usuarioPorCorreo(
      dto.correoUsuario,
      dto.ucheckUsuarioId,
    );
    const fecha = fechaSql(dto.fecha);
    // Un líder marca también en los locales de su cadena (como en su agenda).
    const heredados = await obtenerItinerarioHeredado(this.prisma, {
      id: usuario.id,
      empresaId: usuario.empresaId,
      equipoCampo: usuario.rol?.equipoCampo,
    });

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(${dto.ucheckJornadaId})`;
      const existente = await tx.integracionUcheckEvento.findFirst({
        where: {
          OR: [
            { id: dto.eventoId },
            { ucheckJornadaId: dto.ucheckJornadaId, tipo: dto.tipo },
          ],
        },
        select: { id: true, visitaId: true },
      });
      if (existente)
        return {
          ok: true,
          duplicado: true,
          eventoId: existente.id,
          visitaId: existente.visitaId,
        };

      const asignacion = await tx.asignacionCampo.findFirst({
        where: {
          id: dto.asignacionId,
          localId: dto.localId,
          usuario: { rol: rolDelEquipoCampo(usuario.rol?.equipoCampo) },
          fechaDesde: { lte: fecha },
          OR: [{ fechaHasta: null }, { fechaHasta: { gte: fecha } }],
          empresaId: usuario.empresaId,
          AND: [
            {
              OR: [
                { usuarioId: usuario.id },
                {
                  backups: {
                    some: {
                      usuarioId: usuario.id,
                      activo: true,
                      fechaDesde: { lte: fecha },
                      fechaHasta: { gte: fecha },
                    },
                  },
                },
                ...(heredados.length
                  ? [
                      {
                        usuarioId: { in: heredados },
                        backups: {
                          none: {
                            activo: true,
                            fechaDesde: { lte: fecha },
                            fechaHasta: { gte: fecha },
                          },
                        },
                      },
                      {
                        backups: {
                          some: {
                            activo: true,
                            fechaDesde: { lte: fecha },
                            fechaHasta: { gte: fecha },
                            usuarioId: { in: heredados },
                          },
                        },
                      },
                    ]
                  : []),
              ],
            },
          ],
        },
        select: { id: true, localId: true, usuarioId: true },
      });
      if (!asignacion)
        throw new NotFoundException(
          'La asignación no corresponde al usuario, local y fecha informados',
        );

      if (dto.horarioId) {
        const horario = await tx.horarioCampo.findFirst({
          where: {
            id: dto.horarioId,
            empresaId: usuario.empresaId,
            localId: dto.localId,
            OR: [{ asignacionId: dto.asignacionId }, { asignacionId: null }],
            ...(dto.tipo === 'ENTRADA'
              ? {
                  equipoCampoId: exigirEquipoCampo(usuario.rol?.equipoCampo).id,
                  destinatario: destinatarioCampo(usuario.rol?.equipoCampo),
                }
              : {}),
          },
          select: { id: true },
        });
        if (!horario)
          throw new NotFoundException('El horario no corresponde al local');
      }

      let visita = await tx.visitaCampo.findFirst({
        where: { ucheckJornadaId: dto.ucheckJornadaId },
        select: {
          id: true,
          entrada: true,
          salida: true,
          toleranciasAplicadas: true,
        },
      });

      const snapshot = visita
        ? visita.toleranciasAplicadas
        : dto.toleranciasAplicadas;
      const tolerancias = snapshot ? heredarTolerancias(snapshot) : null;
      const evaluacion =
        tolerancias && dto.horaDesde && dto.horaHasta
          ? evaluarMarcaHorario(
              dto.tipo,
              new Date(dto.registradaEn),
              dto.fecha,
              dto.horaDesde,
              dto.horaHasta,
              'America/Asuncion',
              tolerancias,
            )
          : null;

      if (dto.tipo === 'ENTRADA') {
        if (!visita) {
          visita = await tx.visitaCampo.findFirst({
            where: {
              asignacionId: asignacion.id,
              horarioId: dto.horarioId ?? null,
              fecha,
              usuarioId: usuario.id,
            },
            select: {
              id: true,
              entrada: true,
              salida: true,
              toleranciasAplicadas: true,
            },
          });
        }
        if (visita?.salida)
          throw new ConflictException('La visita ya se encuentra cerrada');
        visita = visita
          ? await tx.visitaCampo.update({
              where: { id: visita.id },
              data: {
                origen: 'UCHECK',
                ucheckJornadaId: dto.ucheckJornadaId,
                entrada: new Date(dto.registradaEn),
                entradaLat: dto.latitud,
                entradaLng: dto.longitud,
                entradaPrecision: dto.precisionMetros,
                entradaDistancia: dto.distanciaMetros,
                entradaFueraHorario: evaluacion
                  ? evaluacion.color !== 'VERDE'
                  : dto.fueraHorario,
                entradaColor: evaluacion?.color,
                toleranciasAplicadas: tolerancias
                  ? { ...tolerancias }
                  : undefined,
                entradaFueraAtencion: dto.fueraAtencion,
              },
              select: {
                id: true,
                entrada: true,
                salida: true,
                toleranciasAplicadas: true,
              },
            })
          : await tx.visitaCampo.create({
              data: {
                empresaId: usuario.empresaId,
                localId: dto.localId,
                asignacionId: asignacion.id,
                usuarioId: usuario.id,
                horarioId: dto.horarioId ?? null,
                fecha,
                entrada: new Date(dto.registradaEn),
                esBackup:
                  asignacion.usuarioId !== usuario.id &&
                  !heredados.includes(asignacion.usuarioId),
                origen: 'UCHECK',
                ucheckJornadaId: dto.ucheckJornadaId,
                entradaLat: dto.latitud,
                entradaLng: dto.longitud,
                entradaPrecision: dto.precisionMetros,
                entradaDistancia: dto.distanciaMetros,
                entradaFueraHorario: evaluacion
                  ? evaluacion.color !== 'VERDE'
                  : dto.fueraHorario,
                entradaColor: evaluacion?.color,
                toleranciasAplicadas: tolerancias
                  ? { ...tolerancias }
                  : undefined,
                entradaFueraAtencion: dto.fueraAtencion,
              },
              select: {
                id: true,
                entrada: true,
                salida: true,
                toleranciasAplicadas: true,
              },
            });
      } else {
        if (!visita)
          throw new ConflictException(
            'La entrada de esta jornada todavía no llegó a Comercia',
          );
        if (new Date(dto.registradaEn) < visita.entrada)
          throw new BadRequestException(
            'La salida no puede ser anterior a la entrada',
          );
        visita = await tx.visitaCampo.update({
          where: { id: visita.id },
          data: {
            salida: new Date(dto.registradaEn),
            salidaLat: dto.latitud,
            salidaLng: dto.longitud,
            salidaPrecision: dto.precisionMetros,
            salidaDistancia: dto.distanciaMetros,
            salidaFueraHorario: evaluacion
              ? evaluacion.color !== 'VERDE'
              : dto.fueraHorario,
            salidaColor: evaluacion?.color,
            salidaFueraAtencion: dto.fueraAtencion,
          },
          select: {
            id: true,
            entrada: true,
            salida: true,
            toleranciasAplicadas: true,
          },
        });
      }

      await tx.integracionUcheckEvento.create({
        data: {
          id: dto.eventoId,
          tipo: dto.tipo,
          ucheckJornadaId: dto.ucheckJornadaId,
          usuarioId: usuario.id,
          empresaId: usuario.empresaId,
          visitaId: visita.id,
          localId: dto.localId,
          asignacionId: dto.asignacionId,
          horarioId: dto.horarioId ?? null,
          correoUsuario: correoNormalizado(dto.correoUsuario),
          registradaEn: new Date(dto.registradaEn),
          capturadaEn: new Date(dto.capturadaEn),
          latitud: dto.latitud,
          longitud: dto.longitud,
          precisionMetros: dto.precisionMetros,
          distanciaMetros: dto.distanciaMetros,
          centroLatitud: dto.centroLatitud,
          centroLongitud: dto.centroLongitud,
          radioMetros: dto.radioMetros,
          horaDesde: dto.horaDesde ?? null,
          horaHasta: dto.horaHasta ?? null,
          fueraHorario: dto.fueraHorario,
          fueraAtencion: dto.fueraAtencion,
          ubicacionSimulada: dto.ubicacionSimulada,
          contextoDispositivo: dto.contextoDispositivo
            ? (dto.contextoDispositivo as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        },
      });
      const operacion = await tx.operacionCampo.findFirst({
        where: {
          usuarioId: usuario.id,
          ucheckJornadaId: dto.ucheckJornadaId,
          tipo: dto.tipo,
        },
        select: { id: true, nota: true },
      });
      if (operacion) {
        await tx.operacionCampo.update({
          where: { id: operacion.id },
          data: { estado: 'CONFIRMADA' },
          select: { id: true },
        });
        if (operacion.nota)
          await tx.visitaCampo.update({
            where: { id: visita.id },
            data:
              dto.tipo === 'ENTRADA'
                ? { notaEntrada: operacion.nota }
                : { notaSalida: operacion.nota },
            select: { id: true },
          });
      }
      return {
        ok: true,
        duplicado: false,
        eventoId: dto.eventoId,
        visitaId: visita.id,
      };
    });
  }
}
