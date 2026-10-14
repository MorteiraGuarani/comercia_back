import { localesOperativos } from '../utils/locales-operativos';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CampoAccesoService } from '../campo-acceso.service';
import {
  ColaboradorResumenItem,
  ConsultaSupervisionDto,
  SupervisionResumenDto,
} from '../dto/supervision.dto';
import { ParadaRuta } from '../interfaces/parada-ruta.interface';
import { fechaCampo, rangoConsulta, relojCampo } from '../utils/calendario';
import { obtenerColaboradoresGestionados } from '../utils/autorizacion';
import {
  destinatarioCampo,
  exigirEquipoCampo,
  EQUIPO_CAMPO_SELECT,
} from '../utils/equipo-campo';
import {
  rangoPaginacion,
  respuestaPaginada,
} from '../../common/utils/paginacion';
import { detalleVisita, selectorMarcaciones } from '../utils/detalle-marcacion';
import {
  asistenciaCampo,
  conEstadoVisita,
  estadoAgenda,
  resumirPresentismo,
} from '../utils/estado-jornada';
import { HORARIO_CAMPO_SELECT } from '../utils/selectores';
import type { EstadoPresentismo } from '../interfaces/estado-jornada.interface';

@Injectable()
export class SupervisionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acceso: CampoAccesoService,
  ) {}

  async marcacionesColaborador(
    usuarioId: number,
    colaboradorId: number,
    query: ConsultaSupervisionDto,
  ) {
    const u = await this.acceso.gestionar(usuarioId, 'visitas');
    const equipoIds = await this.idsEquipo(u);
    if (
      !equipoIds.includes(colaboradorId) &&
      (colaboradorId !== u.id ||
        exigirEquipoCampo(u.equipoCampo).tipo === 'REPOSITOR')
    )
      throw new ForbiddenException('No tienes acceso a este colaborador');
    const { desde, hasta } = rangoConsulta(query);
    const { skip, take, page, limit } = rangoPaginacion(query);
    const where = {
      usuarioId: colaboradorId,
      usuario: { empresaId: u.empresaId },
      local: { empresaId: u.empresaId },
      fecha: { gte: fechaCampo(desde), lte: fechaCampo(hasta) },
    };
    const [total, filas] = await Promise.all([
      this.prisma.visitaCampo.count({ where }),
      this.prisma.visitaCampo.findMany({
        where,
        select: selectorMarcaciones(u.empresaId, colaboradorId),
        skip,
        take,
        orderBy: [{ entrada: 'desc' }, { id: 'desc' }],
      }),
    ]);
    return respuestaPaginada(filas.map(detalleVisita), total, page, limit);
  }

  // El propio líder no se incluye: quien llama decide si puede verse a sí mismo.
  private idsEquipo(u: {
    id: number;
    empresaId: number;
    equipoCampo:
      | import('../../roles/interfaces/equipo-campo.interface').EquipoCampoDto
      | null;
  }) {
    return obtenerColaboradoresGestionados(this.prisma, u);
  }

  private formatoHora(date: Date | string | null): string | null {
    if (!date) return null;
    const d = new Date(date);
    return d.toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'America/Asuncion',
    });
  }

  /**
   * Resumen de supervisión y presentismo del equipo para el Team Leader
   */
  async resumen(
    usuarioId: number,
    query: ConsultaSupervisionDto,
  ): Promise<SupervisionResumenDto> {
    const u = await this.acceso.gestionar(usuarioId, 'visitas');
    const ahora = new Date();
    const esRango = Boolean(query.fechaInicio && query.fechaFin);
    const fechaTexto = esRango
      ? `${query.fechaInicio} al ${query.fechaFin}`
      : (query.fecha ?? relojCampo().fecha);
    const fechaDesdeStr =
      query.fechaInicio ?? query.fecha ?? relojCampo().fecha;
    const fechaHastaStr = query.fechaFin ?? fechaDesdeStr;
    const fechaDesde = fechaCampo(fechaDesdeStr);
    const fechaHasta = fechaCampo(fechaHastaStr);

    // Obtener los subordinados del usuario
    const equipoIds = await this.idsEquipo(u);
    const subordinadosIds = equipoIds.filter((id) => id !== u.id);

    // Si el usuario no tiene subordinados pero es team leader/admin de empresa,
    // buscamos usuarios de la misma empresa con rol inferior o subordinados
    const idsConsultar =
      subordinadosIds.length > 0
        ? subordinadosIds
        : exigirEquipoCampo(u.equipoCampo).tipo === 'REPOSITOR'
          ? []
          : [u.id];

    const usuarios = await this.prisma.usuario.findMany({
      where: {
        id: { in: idsConsultar },
        empresaId: u.empresaId,
        isActive: true,
      },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        celular: true,
        superiorId: true,
        rol: {
          select: {
            descripcion: true,
            equipoCampo: { select: EQUIPO_CAMPO_SELECT },
          },
        },
      },
      orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
    });

    const colaboradores: ColaboradorResumenItem[] = [];

    let totalRutaAsignada = 0;
    let totalRutaCompletada = 0;
    let totalRutaEnCurso = 0;
    let totalRutaIncompleta = 0;
    let totalRutaAusente = 0;

    let totalTareasGlobal = 0;
    let totalTareasCompletadasGlobal = 0;
    let totalObligatoriasPendientesGlobal = 0;

    let enRutaCount = 0;
    let finalizadosCount = 0;
    let sinIniciarCount = 0;
    let incompletosCount = 0;
    let ausentesCount = 0;
    const estadosPresentismo: Record<EstadoPresentismo, number> = {
      SIN_REGISTRO: 0,
      PRESENTE: 0,
      TARDE: 0,
      INCOMPLETO: 0,
      AUSENTE: 0,
    };
    const liderazgo = {
      totalTeamLeaders: 0,
      enRuta: 0,
      finalizados: 0,
      sinIniciar: 0,
      incompletos: 0,
      ausentes: 0,
      visitasCompletadas: 0,
      visitasTotales: 0,
      pctVisitas: 0,
    };

    for (const user of usuarios) {
      const rol = user.rol?.descripcion.toLowerCase().replace(/[^a-z]/g, '');
      const esTeamleader =
        rol === 'teamleader' || rol === 'teamleaderimpulsador';
      // Asignaciones del colaborador para el período
      const asignaciones = await this.prisma.asignacionCampo.findMany({
        where: {
          activo: true,
          fechaDesde: { lte: fechaHasta },
          local: {
            activo: true,
            ...localesOperativos(u.empresaId),
          },
          AND: [
            { OR: [{ fechaHasta: null }, { fechaHasta: { gte: fechaDesde } }] },
            {
              OR: [
                { usuarioId: user.id },
                ...(esTeamleader
                  ? [{ usuario: { superiorId: user.id, isActive: true } }]
                  : []),
                {
                  backups: {
                    some: {
                      usuarioId: user.id,
                      activo: true,
                      fechaDesde: { lte: fechaHasta },
                      fechaHasta: { gte: fechaDesde },
                    },
                  },
                },
              ],
            },
          ],
        },
        select: {
          id: true,
          localId: true,
          usuarioId: true,
          fechaDesde: true,
          fechaHasta: true,
          horarios: {
            where: {
              activo: true,
              equipoCampoId: exigirEquipoCampo(user.rol?.equipoCampo).id,
              destinatario: destinatarioCampo(user.rol?.equipoCampo),
            },
            take: 50,
            select: HORARIO_CAMPO_SELECT,
          },
          local: {
            select: {
              zonaHoraria: true,
              horarios: {
                where: {
                  activo: true,
                  asignacionId: null,
                  equipoCampoId: exigirEquipoCampo(user.rol?.equipoCampo).id,
                },
                take: 50,
                select: HORARIO_CAMPO_SELECT,
              },
            },
          },
        },
      });

      // Visitas registradas en el período por el usuario
      const visitasHoy = await this.prisma.visitaCampo.findMany({
        where: {
          usuarioId: user.id,
          fecha: esRango ? { gte: fechaDesde, lte: fechaHasta } : fechaDesde,
        },
        include: {
          local: { select: { zonaHoraria: true } },
          horario: { select: { entrada: true, salida: true } },
          eventosUcheck: {
            where: { tipo: 'ENTRADA' },
            take: 1,
            select: { horaDesde: true, horaHasta: true },
          },
          cumplimientos: {
            where: { NOT: { completadaAt: null } },
            select: { tareaId: true },
          },
        },
        orderBy: { entrada: 'asc' },
      });

      // Calcular asistencias e In/Out
      const paradasPorLocal = new Map(
        asignaciones.map((a) => [
          a.localId,
          estadoAgenda(
            visitasHoy.filter((v) => v.localId === a.localId),
            esTeamleader && a.usuarioId !== user.id
              ? []
              : a.horarios.length
                ? a.horarios
                : a.local.horarios,
            a.local.zonaHoraria,
            fechaDesdeStr,
            fechaHastaStr,
            ahora,
            a,
          ),
        ]),
      );
      for (const v of visitasHoy.filter(
        (v) => !asignaciones.some((a) => a.localId === v.localId),
      )) {
        paradasPorLocal.set(
          v.localId,
          estadoAgenda(
            visitasHoy.filter((x) => x.localId === v.localId),
            [],
            v.local.zonaHoraria,
            fechaDesdeStr,
            fechaHastaStr,
            ahora,
          ),
        );
      }
      const paradas = Array.from(paradasPorLocal.values());
      const asistencia = asistenciaCampo(paradas.map((p) => p.estado));
      const estadoPresentismo = resumirPresentismo(
        paradas.map((p) => p.estadoPresentismo),
      );
      estadosPresentismo[estadoPresentismo]++;
      let inicioJornada: string | null = null;
      let finJornada: string | null = null;

      if (visitasHoy.length > 0) {
        inicioJornada = this.formatoHora(visitasHoy[0].entrada);
        if (asistencia === 'finalizado') {
          finJornada = this.formatoHora(
            visitasHoy[visitasHoy.length - 1].salida,
          );
        }
      }

      if (asistencia === 'en_curso') enRutaCount++;
      else if (asistencia === 'finalizado') finalizadosCount++;
      else if (asistencia === 'incompleto') incompletosCount++;
      else if (asistencia === 'ausente') ausentesCount++;
      else sinIniciarCount++;

      // Métricas de ruta del colaborador
      const totalVisitas = paradas.length;
      const completadasVisitas = paradas.filter(
        (p) => p.estado === 'completado',
      ).length;
      const incompletasVisitas = paradas.filter(
        (p) => p.estado === 'incompleto',
      ).length;
      const ausentesVisitas = paradas.filter(
        (p) => p.estado === 'ausente',
      ).length;
      const enCursoVisitas = paradas.filter(
        (p) => p.estado === 'en_curso',
      ).length;
      const pctRuta = totalVisitas
        ? Math.round((completadasVisitas / totalVisitas) * 100)
        : 0;
      if (esTeamleader && user.superiorId === u.id) {
        liderazgo.totalTeamLeaders++;
        liderazgo.visitasTotales += totalVisitas;
        liderazgo.visitasCompletadas += completadasVisitas;
        if (asistencia === 'en_curso') liderazgo.enRuta++;
        else if (asistencia === 'finalizado') liderazgo.finalizados++;
        else if (asistencia === 'incompleto') liderazgo.incompletos++;
        else if (asistencia === 'ausente') liderazgo.ausentes++;
        else liderazgo.sinIniciar++;
      }

      totalRutaAsignada += totalVisitas;
      totalRutaCompletada += completadasVisitas;
      totalRutaEnCurso += enCursoVisitas;
      totalRutaIncompleta += incompletasVisitas;
      totalRutaAusente += ausentesVisitas;

      // Métricas de tareas del colaborador
      const localIds = Array.from(
        new Set([
          ...asignaciones.map((a) => a.localId),
          ...visitasHoy.map((v) => v.localId),
        ]),
      );

      const tareasAplicables = esTeamleader
        ? []
        : await this.prisma.tareaCampo.findMany({
            where: {
              empresaId: u.empresaId,
              activo: true,
              equipoCampoId: exigirEquipoCampo(user.rol?.equipoCampo).id,
              destinatario: destinatarioCampo(user.rol?.equipoCampo),
              fechaDesde: { lte: fechaHasta },
              OR: [{ fechaHasta: null }, { fechaHasta: { gte: fechaDesde } }],
              AND: [
                {
                  OR: [
                    { todosLocales: true },
                    { locales: { some: { localId: { in: localIds } } } },
                  ],
                },
              ],
            },
            select: {
              id: true,
              esObligatoria: true,
            },
          });

      const cumplimientosIds = new Set(
        visitasHoy.flatMap((v) => v.cumplimientos.map((c) => c.tareaId)),
      );

      const totalTareas = tareasAplicables.length;
      const completadasTareas = tareasAplicables.filter((t) =>
        cumplimientosIds.has(t.id),
      ).length;
      const obligPendientes = tareasAplicables.filter(
        (t) => t.esObligatoria && !cumplimientosIds.has(t.id),
      ).length;
      const pctTareas = totalTareas
        ? Math.round((completadasTareas / totalTareas) * 100)
        : 0;

      totalTareasGlobal += totalTareas;
      totalTareasCompletadasGlobal += completadasTareas;
      totalObligatoriasPendientesGlobal += obligPendientes;

      // Novedades reportadas en el período
      const novedadesCount = await this.prisma.novedadCampo.count({
        where: {
          usuarioId: user.id,
          creadoAt: {
            gte: new Date(fechaDesdeStr + 'T00:00:00.000Z'),
            lte: new Date(fechaHastaStr + 'T23:59:59.999Z'),
          },
        },
      });

      const iniciales =
        `${user.nombre[0] ?? ''}${user.apellido[0] ?? ''}`.toUpperCase();

      colaboradores.push({
        id: user.id,
        nombre: `${user.nombre} ${user.apellido}`,
        iniciales,
        zona: user.rol?.descripcion ?? 'Comercial',
        telefono: user.celular || '—',
        asistencia,
        estadoPresentismo,
        inicioJornada,
        finJornada,
        ruta: {
          total: totalVisitas,
          completadas: completadasVisitas,
          enCurso: enCursoVisitas,
          incompletas: incompletasVisitas,
          ausentes: ausentesVisitas,
          pct: pctRuta,
        },
        tareas: {
          total: totalTareas,
          completadas: completadasTareas,
          obligPendientes,
          pct: pctTareas,
        },
        novedadesCount,
      });
    }

    const totalRutaPct = totalRutaAsignada
      ? Math.round((totalRutaCompletada / totalRutaAsignada) * 100)
      : 0;
    const totalTareasPct = totalTareasGlobal
      ? Math.round((totalTareasCompletadasGlobal / totalTareasGlobal) * 100)
      : 0;
    liderazgo.pctVisitas = liderazgo.visitasTotales
      ? Math.round(
          (liderazgo.visitasCompletadas / liderazgo.visitasTotales) * 100,
        )
      : 0;

    return {
      fecha: fechaTexto,
      liderazgo,
      presentismo: {
        enRuta: enRutaCount,
        finalizados: finalizadosCount,
        sinIniciar: sinIniciarCount,
        incompletos: incompletosCount,
        ausentes: ausentesCount,
        estados: estadosPresentismo,
        totalEquipo: usuarios.length,
      },
      rutas: {
        total: totalRutaAsignada,
        completadas: totalRutaCompletada,
        enCurso: totalRutaEnCurso,
        incompletas: totalRutaIncompleta,
        ausentes: totalRutaAusente,
        pendientes: Math.max(
          0,
          totalRutaAsignada -
            totalRutaCompletada -
            totalRutaEnCurso -
            totalRutaIncompleta -
            totalRutaAusente,
        ),
        pct: totalRutaPct,
      },
      tareas: {
        total: totalTareasGlobal,
        completadas: totalTareasCompletadasGlobal,
        obligatoriasPendientes: totalObligatoriasPendientesGlobal,
        pct: totalTareasPct,
      },
      colaboradores,
    };
  }

  /**
   * Obtener detalle completo de un colaborador (Ruta, Tareas por categoría, Novedades)
   */
  async detalleColaborador(
    usuarioId: number,
    colaboradorId: number,
    query: ConsultaSupervisionDto,
  ) {
    const u = await this.acceso.gestionar(usuarioId, 'visitas');
    const { desde, hasta } = rangoConsulta(query);
    const fechaDesde = fechaCampo(desde);
    const fechaHasta = fechaCampo(hasta);
    const ahora = new Date();

    const equipoIds = await this.idsEquipo(u);
    if (
      !equipoIds.includes(colaboradorId) &&
      (colaboradorId !== u.id ||
        exigirEquipoCampo(u.equipoCampo).tipo === 'REPOSITOR')
    ) {
      throw new ForbiddenException('No tienes acceso a este colaborador');
    }

    const user = await this.prisma.usuario.findFirst({
      where: { id: colaboradorId, empresaId: u.empresaId },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        celular: true,
        correo: true,
        rol: {
          select: {
            descripcion: true,
            equipoCampo: { select: EQUIPO_CAMPO_SELECT },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Colaborador no encontrado');
    }

    const asignaciones = await this.prisma.asignacionCampo.findMany({
      where: {
        activo: true,
        fechaDesde: { lte: fechaHasta },
        local: {
          activo: true,
          ...localesOperativos(u.empresaId),
        },
        AND: [
          { OR: [{ fechaHasta: null }, { fechaHasta: { gte: fechaDesde } }] },
          {
            OR: [
              { usuarioId: user.id },
              {
                backups: {
                  some: {
                    usuarioId: user.id,
                    activo: true,
                    fechaDesde: { lte: fechaHasta },
                    fechaHasta: { gte: fechaDesde },
                  },
                },
              },
            ],
          },
        ],
      },
      include: {
        horarios: {
          where: {
            activo: true,
            equipoCampoId: exigirEquipoCampo(user.rol?.equipoCampo).id,
            destinatario: destinatarioCampo(user.rol?.equipoCampo),
          },
          select: HORARIO_CAMPO_SELECT,
          orderBy: { entrada: 'asc' },
          take: 5,
        },
        local: {
          include: {
            cliente: { select: { id: true, nombre: true } },
            horarios: {
              where: {
                activo: true,
                asignacionId: null,
                equipoCampoId: exigirEquipoCampo(user.rol?.equipoCampo).id,
                destinatario: destinatarioCampo(user.rol?.equipoCampo),
              },
              select: HORARIO_CAMPO_SELECT,
              orderBy: { entrada: 'asc' },
              take: 5,
            },
          },
        },
      },
    });

    const visitas = await this.prisma.visitaCampo.findMany({
      where: {
        usuarioId: user.id,
        fecha: { gte: fechaDesde, lte: fechaHasta },
      },
      include: {
        horario: { select: { entrada: true, salida: true } },
        eventosUcheck: {
          where: { tipo: 'ENTRADA' },
          take: 1,
          select: { horaDesde: true, horaHasta: true },
        },
        local: {
          include: {
            cliente: { select: { id: true, nombre: true } },
            horarios: {
              where: {
                activo: true,
                asignacionId: null,
                equipoCampoId: exigirEquipoCampo(user.rol?.equipoCampo).id,
                destinatario: destinatarioCampo(user.rol?.equipoCampo),
              },
              select: HORARIO_CAMPO_SELECT,
              orderBy: { entrada: 'asc' },
              take: 5,
            },
          },
        },
        cumplimientos: {
          select: {
            tareaId: true,
            nombreTarea: true,
            completadaAt: true,
            fotos: {
              select: { id: true, momento: true, creadoAt: true },
              take: 2,
            },
            comentarios: {
              select: {
                id: true,
                comentario: true,
                creadoAt: true,
                usuario: { select: { nombre: true, apellido: true } },
              },
              orderBy: { creadoAt: 'desc' },
              take: 20,
            },
          },
        },
      },
      orderBy: { entrada: 'asc' },
    });

    // Armar la ruta del día ordenada
    const paradasMap = new Map<number, ParadaRuta>();

    // Primero asignaciones
    for (const a of asignaciones) {
      const h = (a.horarios.length ? a.horarios : a.local.horarios)[0];
      const ventana = h ? `${h.entrada} – ${h.salida}` : '08:00 – 18:00';
      paradasMap.set(a.local.id, {
        id: `local-${a.local.id}`,
        localId: a.local.id,
        cliente: a.local.cliente?.nombre ?? 'Sin cliente',
        local: a.local.nombre,
        tipo: 'supermercado', // default semántico
        ventana,
        ...estadoAgenda(
          [],
          a.horarios.length ? a.horarios : a.local.horarios,
          a.local.zonaHoraria,
          desde,
          hasta,
          ahora,
          a,
        ),
        checkin: null,
        checkout: null,
      });
    }

    // Actualizar con visitas reales
    for (const v of visitas) {
      const existing = paradasMap.get(v.local.id);
      const h = v.local.horarios[0];
      const ventana = h ? `${h.entrada} – ${h.salida}` : '08:00 – 18:00';
      const a = asignaciones.find((a) => a.local.id === v.local.id);
      const estado = estadoAgenda(
        visitas.filter((x) => x.localId === v.localId),
        a?.horarios.length ? a.horarios : (a?.local.horarios ?? []),
        v.local.zonaHoraria,
        desde,
        hasta,
        ahora,
        a,
      );

      paradasMap.set(v.local.id, {
        id: `visita-${v.id}`,
        localId: v.local.id,
        cliente: v.local.cliente?.nombre ?? 'Sin cliente',
        local: v.local.nombre,
        tipo: 'supermercado',
        ventana: existing?.ventana ?? ventana,
        ...estado,
        checkin: this.formatoHora(v.entrada),
        checkout: this.formatoHora(v.salida),
      });
    }

    const ruta = Array.from(paradasMap.values());

    // Asistencia
    const asistencia = asistenciaCampo(ruta.map((p) => p.estado));
    const estadoPresentismo = resumirPresentismo(
      ruta.map((p) => p.estadoPresentismo),
    );

    const inicioJornada =
      visitas.length > 0 ? this.formatoHora(visitas[0].entrada) : null;
    const finJornada =
      asistencia === 'finalizado' && visitas.length > 0
        ? this.formatoHora(visitas[visitas.length - 1].salida)
        : null;

    // Tareas por categoría
    const localIds = Array.from(paradasMap.keys());
    const tareas = await this.prisma.tareaCampo.findMany({
      where: {
        empresaId: u.empresaId,
        activo: true,
        equipoCampoId: exigirEquipoCampo(user.rol?.equipoCampo).id,
        destinatario: destinatarioCampo(user.rol?.equipoCampo),
        fechaDesde: { lte: fechaHasta },
        OR: [{ fechaHasta: null }, { fechaHasta: { gte: fechaDesde } }],
        AND: [
          {
            OR: [
              { todosLocales: true },
              { locales: { some: { localId: { in: localIds } } } },
            ],
          },
        ],
      },
      select: {
        id: true,
        nombre: true,
        categoria: true,
        esObligatoria: true,
      },
    });

    const tareasCumplidasSet = new Set(
      visitas.flatMap((v) =>
        v.cumplimientos.filter((c) => c.completadaAt).map((c) => c.tareaId),
      ),
    );

    const evidencias = visitas.flatMap((visita) =>
      visita.cumplimientos.map((cumplimiento) => ({
        visitaId: visita.id,
        local: visita.local.nombre,
        cliente: visita.local.cliente?.nombre ?? 'Sin cliente',
        fecha: visita.fecha,
        entrada: visita.entrada,
        salida: visita.salida,
        estado: conEstadoVisita(visita, ahora).estado,
        estadoPresentismo: conEstadoVisita(visita, ahora).estadoPresentismo,
        tareaId: cumplimiento.tareaId,
        nombreTarea: cumplimiento.nombreTarea,
        completadaAt: cumplimiento.completadaAt,
        fotos: cumplimiento.fotos.map((foto) => ({
          id: foto.id,
          momento: foto.momento,
          creadoAt: foto.creadoAt,
        })),
        comentarios: cumplimiento.comentarios,
      })),
    );

    // Agrupar por categoría
    const categoriasMap = new Map<
      string,
      {
        total: number;
        completadas: number;
        obligPendiente: boolean;
        tareas: any[];
      }
    >();

    for (const t of tareas) {
      const cat = t.categoria || 'Relevamiento';
      const curr = categoriasMap.get(cat) ?? {
        total: 0,
        completadas: 0,
        obligPendiente: false,
        tareas: [],
      };
      curr.total++;
      const completada = tareasCumplidasSet.has(t.id);
      if (completada) {
        curr.completadas++;
      } else if (t.esObligatoria) {
        curr.obligPendiente = true;
      }
      curr.tareas.push({
        id: t.id,
        nombre: t.nombre,
        esObligatoria: t.esObligatoria,
        completada,
      });
      categoriasMap.set(cat, curr);
    }

    const tareasCategorias = Array.from(categoriasMap.entries()).map(
      ([categoria, datos]) => ({
        categoria,
        ...datos,
      }),
    );

    // Novedades de hoy
    const novedades = await this.prisma.novedadCampo.findMany({
      where: {
        usuarioId: user.id,
        creadoAt: {
          gte: new Date(desde + 'T00:00:00.000Z'),
          lte: new Date(hasta + 'T23:59:59.999Z'),
        },
      },
      include: {
        local: { select: { id: true, nombre: true } },
      },
      orderBy: { creadoAt: 'desc' },
    });

    const novedadesFormat = novedades.map((n) => ({
      id: `n${n.id}`,
      novedadId: n.id,
      tipo: n.tipo,
      estado: n.estado.toLowerCase(),
      texto: n.descripcion,
      cliente: n.local.nombre,
      hora: this.formatoHora(n.creadoAt) ?? 'hoy',
    }));

    const iniciales =
      `${user.nombre[0] ?? ''}${user.apellido[0] ?? ''}`.toUpperCase();

    return {
      colaborador: {
        id: user.id,
        nombre: `${user.nombre} ${user.apellido}`,
        iniciales,
        zona: user.rol?.descripcion ?? 'Comercial',
        telefono: user.celular || '—',
        email: user.correo,
        asistencia,
        estadoPresentismo,
        inicioJornada,
        finJornada,
      },
      ruta,
      tareasCategorias,
      evidencias,
      novedades: novedadesFormat,
    };
  }
}
