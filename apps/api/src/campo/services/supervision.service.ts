import { avanceTareasPorLocal } from '../utils/avance-tareas';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { Prisma } from '../../../generated/prisma/client';
import { CampoAccesoService } from '../campo-acceso.service';
import {
  ColaboradorResumenItem,
  ConsultaSupervisionDto,
  SupervisionResumenDto,
} from '../dto/supervision.dto';
import { ParadaRuta } from '../interfaces/parada-ruta.interface';
import {
  fechaCampo,
  rangoConsulta,
  relojCampo,
  ZONA_CAMPO,
} from '../utils/calendario';
import { nombreLocal } from '../utils/local-ocrd';
import {
  obtenerEquipoCompleto,
  obtenerItinerarioHeredado,
  obtenerPersonalJefatura,
} from '../utils/autorizacion';
import { alcanceGestor } from '../utils/equipos-gestion';
import type { VistaSupervision } from '../interfaces/vista-supervision.interface';
import {
  destinatarioCampo,
  exigirEquipoCampo,
  EQUIPO_CAMPO_SELECT,
  EQUIPO_TITULAR_SELECT,
  ROL_OPERATIVO,
} from '../utils/equipo-campo';
import {
  rangoPaginacion,
  respuestaPaginada,
} from '../../common/utils/paginacion';
import { detalleVisita, selectorMarcaciones } from '../utils/detalle-marcacion';
import {
  asistenciaCampo,
  conEstadoVisita,
  ausenciasAgenda,
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
    vista: VistaSupervision = 'equipo',
  ) {
    const u = await this.colaboradorVisible(usuarioId, colaboradorId, vista);
    const { desde, hasta } = rangoConsulta(query);
    const { skip, take, page, limit } = rangoPaginacion(query);
    const where = {
      usuarioId: colaboradorId,
      usuario: { empresaId: u.empresaId },
      empresaId: u.empresaId,
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

  // Presentismo es de consulta: el líder ve toda su cadena del mismo equipo
  // operativo (también en repositores), aunque nadie haya marcado. Los ABM
  // resuelven su personal por equipo operativo; esta consulta conserva la
  // jerarquía. El propio líder no se incluye: quien llama decide si puede verse.
  private async idsEquipo(u: { id: number }) {
    return (await obtenerEquipoCompleto(this.prisma, u.id)).filter(
      (id) => id !== u.id,
    );
  }

  /**
   * A quién ve quien consulta. El líder: su cadena del mismo equipo, y él
   * mismo si es impulsador sin colaboradores. El jefe: todo su organigrama.
   */
  private async alcance(usuarioId: number, vista: VistaSupervision) {
    if (vista === 'jefatura') {
      const u = await this.acceso.jefatura(usuarioId);
      const [ids, gestion] = await Promise.all([
        obtenerPersonalJefatura(this.prisma, u),
        alcanceGestor(this.prisma, u.id),
      ]);
      // El equipo elegido arriba ("Equipo") filtra el personal de campo.
      return { u, ids, propio: false, equipoId: gestion?.activo?.id ?? null };
    }
    const u = await this.acceso.gestionar(usuarioId, 'visitas');
    return {
      u,
      ids: await this.idsEquipo(u),
      propio:
        !u.gestor && exigirEquipoCampo(u.equipoCampo).tipo !== 'REPOSITOR',
      equipoId: null,
    };
  }

  private async colaboradorVisible(
    usuarioId: number,
    colaboradorId: number,
    vista: VistaSupervision,
  ) {
    const { u, ids, propio } = await this.alcance(usuarioId, vista);
    if (!ids.includes(colaboradorId) && !(propio && colaboradorId === u.id))
      throw new ForbiddenException('No tienes acceso a este colaborador');
    return u;
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
    vista: VistaSupervision = 'equipo',
  ): Promise<SupervisionResumenDto> {
    const { u, ids, propio, equipoId } = await this.alcance(usuarioId, vista);
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

    // Sin colaboradores, el impulsador se ve a sí mismo.
    const idsConsultar = ids.length ? ids : propio ? [u.id] : [];
    // En el organigrama del jefe hay roles sin trabajo de campo (back
    // office, otras jefaturas): solo suma quien tiene equipo operativo.
    const deCampo: Prisma.RolWhereInput = {
      equipoCampo: {
        activo: true,
        tipo: { in: ['IMPULSADOR', 'REPOSITOR'] },
      },
    };

    const [usuarios, mandos, organigrama] = await Promise.all([
      this.prisma.usuario.findMany({
        where: {
          id: { in: idsConsultar },
          empresaId: u.empresaId,
          isActive: true,
          rol: {
            ...deCampo,
            ...(equipoId ? { equipoCampoId: equipoId } : {}),
          },
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
      }),
      // Jefatura: los mandos intermedios (gerente › jefe › …) arman la cascada.
      vista === 'jefatura'
        ? this.prisma.usuario.findMany({
            where: {
              id: { in: idsConsultar },
              empresaId: u.empresaId,
              isActive: true,
              NOT: { rol: deCampo },
            },
            select: {
              id: true,
              nombre: true,
              apellido: true,
              superiorId: true,
              rol: { select: { descripcion: true } },
            },
            orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
            take: 2000,
          })
        : Promise.resolve<
            Prisma.UsuarioGetPayload<{
              select: {
                id: true;
                nombre: true;
                apellido: true;
                superiorId: true;
                rol: { select: { descripcion: true } };
              };
            }>[]
          >([]),
      // Quién depende de quién dentro del alcance: cada líder hereda su cadena.
      this.prisma.usuario.findMany({
        where: {
          id: { in: idsConsultar },
          empresaId: u.empresaId,
          isActive: true,
          esSuperadmin: false,
        },
        select: { id: true, superiorId: true },
        take: 2000,
      }),
    ]);

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
      PRESENTE: 0,
      EN_CURSO: 0,
      INCOMPLETO: 0,
      AUSENTE: 0,
      SIN_REGISTRO: 0,
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

    // Una consulta por tipo de equipo (asignaciones y tareas) y una para todo
    // el equipo (visitas y novedades), en vez de varias por colaborador.
    const esTeamleaderUsuario = (user: (typeof usuarios)[number]) => {
      const rol = user.rol?.descripcion.toLowerCase().replace(/[^a-z]/g, '');
      return rol === 'teamleader' || rol === 'teamleaderimpulsador';
    };
    const grupos = new Map<number, typeof usuarios>();
    for (const user of usuarios) {
      const equipoId = exigirEquipoCampo(user.rol?.equipoCampo).id;
      grupos.set(equipoId, [...(grupos.get(equipoId) ?? []), user]);
    }
    const idsUsuarios = usuarios.map((user) => user.id);
    const vigenteEnPeriodo = {
      activo: true,
      fechaDesde: { lte: fechaHasta },
      fechaHasta: { gte: fechaDesde },
    };
    const hijos = new Map<number, number[]>();
    for (const p of organigrama)
      if (p.superiorId !== null)
        hijos.set(p.superiorId, [...(hijos.get(p.superiorId) ?? []), p.id]);
    const cadenaDe = (id: number) => {
      const cadena = new Set<number>();
      for (let nivel = hijos.get(id) ?? []; nivel.length;) {
        const nuevos = nivel.filter((h) => !cadena.has(h));
        nuevos.forEach((h) => cadena.add(h));
        nivel = nuevos.flatMap((h) => hijos.get(h) ?? []);
      }
      return cadena;
    };
    const cadenas = new Map(idsUsuarios.map((id) => [id, cadenaDe(id)]));
    const heredables = [
      ...new Set([...cadenas.values()].flatMap((c) => [...c])),
    ];
    const [asignacionesPorGrupo, visitasEquipo, novedadesEquipo, heredadas] =
      await Promise.all([
        Promise.all(
          Array.from(grupos.values()).map((miembros) => {
            const equipo = exigirEquipoCampo(miembros[0].rol?.equipoCampo);
            const ids = miembros.map((m) => m.id);
            return this.prisma.asignacionCampo.findMany({
              where: {
                activo: true,
                fechaDesde: { lte: fechaHasta },
                empresaId: u.empresaId,
                AND: [
                  {
                    OR: [
                      { fechaHasta: null },
                      { fechaHasta: { gte: fechaDesde } },
                    ],
                  },
                  {
                    OR: [
                      { usuarioId: { in: ids } },
                      {
                        backups: {
                          some: { usuarioId: { in: ids }, ...vigenteEnPeriodo },
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
                backups: {
                  where: { usuarioId: { in: ids }, ...vigenteEnPeriodo },
                  select: { usuarioId: true },
                },
                horarios: {
                  where: {
                    activo: true,
                    equipoCampoId: equipo.id,
                    destinatario: equipo.tipo,
                  },
                  take: 50,
                  select: HORARIO_CAMPO_SELECT,
                },
                local: {
                  select: {
                    horarios: {
                      where: {
                        activo: true,
                        asignacionId: null,
                        equipoCampoId: equipo.id,
                      },
                      take: 50,
                      select: HORARIO_CAMPO_SELECT,
                    },
                  },
                },
              },
            });
          }),
        ),
        // Visitas registradas en el período por el equipo
        this.prisma.visitaCampo.findMany({
          where: {
            usuarioId: { in: idsUsuarios },
            fecha: esRango ? { gte: fechaDesde, lte: fechaHasta } : fechaDesde,
          },
          include: {
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
        }),
        // Novedades reportadas en el período
        this.prisma.novedadCampo.groupBy({
          by: ['usuarioId'],
          where: {
            usuarioId: { in: idsUsuarios },
            creadoAt: {
              gte: new Date(fechaDesdeStr + 'T00:00:00.000Z'),
              lte: new Date(fechaHastaStr + 'T23:59:59.999Z'),
            },
          },
          _count: { _all: true },
        }),
        // Locales de la cadena de cada líder (Itinerario): sin horario propio.
        // Sin cadena, `in: []` no devuelve nada.
        this.prisma.asignacionCampo.findMany({
          where: {
            activo: true,
            empresaId: u.empresaId,
            fechaDesde: { lte: fechaHasta },
            OR: [{ fechaHasta: null }, { fechaHasta: { gte: fechaDesde } }],
            usuarioId: { in: heredables },
            usuario: { rol: ROL_OPERATIVO },
          },
          select: {
            id: true,
            localId: true,
            usuarioId: true,
            fechaDesde: true,
            fechaHasta: true,
          },
        }),
      ]);
    const asignacionesEquipo = asignacionesPorGrupo.flat();
    const novedadesPorUsuario = new Map(
      novedadesEquipo.map((n) => [n.usuarioId, n._count._all]),
    );
    const datosPorUsuario = new Map(
      usuarios.map((user) => {
        const esTeamleader = esTeamleaderUsuario(user);
        const asignaciones = asignacionesEquipo.filter(
          (a) =>
            a.usuarioId === user.id ||
            a.backups.some((b) => b.usuarioId === user.id),
        );
        const cadena = cadenas.get(user.id) ?? new Set<number>();
        const heredadasUsuario = heredadas.filter((a) =>
          cadena.has(a.usuarioId),
        );
        const visitasHoy = visitasEquipo.filter((v) => v.usuarioId === user.id);
        // Las tareas se miden en sus locales propios y en los que visitó.
        const localIds = new Set([
          ...asignaciones.map((a) => a.localId),
          ...visitasHoy.map((v) => v.localId),
        ]);
        return [
          user.id,
          {
            esTeamleader,
            asignaciones,
            heredadasUsuario,
            visitasHoy,
            localIds,
          },
        ];
      }),
    );
    // Tareas aplicables por tipo de equipo; cada colaborador se queda con las
    // de todos los locales o las de alguno de sus locales.
    const tareasPorGrupo = new Map(
      await Promise.all(
        Array.from(grupos.entries()).map(async ([equipoId, miembros]) => {
          const equipo = exigirEquipoCampo(miembros[0].rol?.equipoCampo);
          const localesGrupo = Array.from(
            new Set(
              miembros.flatMap((m) =>
                Array.from(datosPorUsuario.get(m.id)?.localIds ?? []),
              ),
            ),
          );
          if (localesGrupo.length === 0) return [equipoId, null] as const;
          const tareas = await this.prisma.tareaCampo.findMany({
            where: {
              empresaId: u.empresaId,
              activo: true,
              equipoCampoId: equipo.id,
              destinatario: equipo.tipo,
              fechaDesde: { lte: fechaHasta },
              OR: [{ fechaHasta: null }, { fechaHasta: { gte: fechaDesde } }],
              AND: [
                {
                  OR: [
                    { todosLocales: true },
                    { locales: { some: { localId: { in: localesGrupo } } } },
                  ],
                },
              ],
            },
            select: {
              id: true,
              esObligatoria: true,
              todosLocales: true,
              locales: {
                where: { localId: { in: localesGrupo } },
                select: { localId: true },
              },
            },
          });
          return [equipoId, tareas] as const;
        }),
      ),
    );

    for (const user of usuarios) {
      const datos = datosPorUsuario.get(user.id);
      if (!datos) continue;
      const { esTeamleader, asignaciones, heredadasUsuario, visitasHoy } =
        datos;

      // Calcular asistencias e In/Out. Un local heredado no le exige horario
      // al líder; si además es suyo, manda su propia asignación.
      const paradasPorLocal = new Map([
        ...heredadasUsuario.map(
          (a) =>
            [
              a.localId,
              estadoAgenda(
                visitasHoy.filter((v) => v.localId === a.localId),
                [],
                ZONA_CAMPO,
                fechaDesdeStr,
                fechaHastaStr,
                ahora,
                a,
              ),
            ] as const,
        ),
        ...asignaciones.map(
          (a) =>
            [
              a.localId,
              estadoAgenda(
                visitasHoy.filter((v) => v.localId === a.localId),
                a.horarios.length ? a.horarios : a.local.horarios,
                ZONA_CAMPO,
                fechaDesdeStr,
                fechaHastaStr,
                ahora,
                a,
              ),
            ] as const,
        ),
      ]);
      for (const v of visitasHoy.filter(
        (v) => !paradasPorLocal.has(v.localId),
      )) {
        paradasPorLocal.set(
          v.localId,
          estadoAgenda(
            visitasHoy.filter((x) => x.localId === v.localId),
            [],
            ZONA_CAMPO,
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

      // Métricas de tareas del colaborador: cada tarea por cada local de su ruta.
      const {
        total: totalTareas,
        completadas: completadasTareas,
        obligPendientes,
      } = avanceTareasPorLocal(
        datos.localIds,
        tareasPorGrupo.get(exigirEquipoCampo(user.rol?.equipoCampo).id) ?? [],
        visitasHoy,
      );
      const pctTareas = totalTareas
        ? Math.round((completadasTareas / totalTareas) * 100)
        : 0;

      totalTareasGlobal += totalTareas;
      totalTareasCompletadasGlobal += completadasTareas;
      totalObligatoriasPendientesGlobal += obligPendientes;

      const novedadesCount = novedadesPorUsuario.get(user.id) ?? 0;

      const iniciales =
        `${user.nombre[0] ?? ''}${user.apellido[0] ?? ''}`.toUpperCase();

      colaboradores.push({
        id: user.id,
        superiorId: user.superiorId,
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
      ...(vista === 'jefatura'
        ? {
            estructura: mandos.map((m) => ({
              id: m.id,
              superiorId: m.superiorId,
              nombre: `${m.nombre} ${m.apellido}`,
              iniciales:
                `${m.nombre[0] ?? ''}${m.apellido[0] ?? ''}`.toUpperCase(),
              zona: m.rol?.descripcion ?? 'Sin rol',
            })),
          }
        : {}),
    };
  }

  /**
   * Obtener detalle completo de un colaborador (Ruta, Tareas por categoría, Novedades)
   */
  async detalleColaborador(
    usuarioId: number,
    colaboradorId: number,
    query: ConsultaSupervisionDto,
    vista: VistaSupervision = 'equipo',
  ) {
    const u = await this.colaboradorVisible(usuarioId, colaboradorId, vista);
    const { desde, hasta } = rangoConsulta(query);
    const fechaDesde = fechaCampo(desde);
    const fechaHasta = fechaCampo(hasta);
    const ahora = new Date();

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
    const equipoUsuario = exigirEquipoCampo(user.rol?.equipoCampo);
    // Un líder recorre también los locales de toda su cadena (Itinerario).
    const heredados = await obtenerItinerarioHeredado(this.prisma, {
      id: user.id,
      empresaId: u.empresaId,
    });
    const backupVigente = {
      usuarioId: user.id,
      activo: true,
      fechaDesde: { lte: fechaHasta },
      fechaHasta: { gte: fechaDesde },
    };

    // Independientes entre sí: van en paralelo.
    const [asignaciones, visitas, novedades] = await Promise.all([
      this.prisma.asignacionCampo.findMany({
        where: {
          activo: true,
          fechaDesde: { lte: fechaHasta },
          empresaId: u.empresaId,
          AND: [
            { OR: [{ fechaHasta: null }, { fechaHasta: { gte: fechaDesde } }] },
            {
              OR: [
                { usuarioId: user.id },
                { backups: { some: backupVigente } },
                ...(heredados.length
                  ? [
                      {
                        usuarioId: { in: heredados },
                        usuario: { rol: ROL_OPERATIVO },
                      },
                    ]
                  : []),
              ],
            },
          ],
        },
        include: {
          ...EQUIPO_TITULAR_SELECT,
          backups: { where: backupVigente, select: { id: true } },
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
      }),
      this.prisma.visitaCampo.findMany({
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
      }),
      // Novedades del período (las 50 más recientes)
      this.prisma.novedadCampo.findMany({
        where: {
          usuarioId: user.id,
          creadoAt: {
            gte: new Date(desde + 'T00:00:00.000Z'),
            lte: new Date(hasta + 'T23:59:59.999Z'),
          },
        },
        include: {
          local: { select: { CardCode: true, CardName: true } },
        },
        orderBy: { creadoAt: 'desc' },
        take: 50,
      }),
    ]);

    // Armar la ruta del día ordenada
    const paradasMap = new Map<string, ParadaRuta>();
    const propia = (a: (typeof asignaciones)[number]) =>
      a.usuarioId === user.id || a.backups.length > 0;
    // Un local heredado no le exige horario al líder: no suma ausencias.
    const horariosDe = (a: (typeof asignaciones)[number] | undefined) =>
      !a || !propia(a) ? [] : a.horarios.length ? a.horarios : a.local.horarios;
    // La asignación propia gana sobre la heredada del mismo local.
    const asignacionPorLocal = new Map(
      [...asignaciones]
        .sort((x, y) => Number(propia(x)) - Number(propia(y)))
        .map((a) => [a.localId, a]),
    );

    // Primero asignaciones
    for (const a of asignacionPorLocal.values()) {
      const h = (a.horarios.length ? a.horarios : a.local.horarios)[0];
      const ventana = h ? `${h.entrada} – ${h.salida}` : '08:00 – 18:00';
      paradasMap.set(a.localId, {
        id: `local-${a.localId}`,
        localId: a.localId,
        local: nombreLocal(a.local),
        tipo: 'supermercado', // default semántico
        ventana,
        ...estadoAgenda([], horariosDe(a), ZONA_CAMPO, desde, hasta, ahora, a),
        visitas: 0,
        ausencias: ausenciasAgenda(
          [],
          horariosDe(a),
          ZONA_CAMPO,
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
      const existing = paradasMap.get(v.localId);
      const h = v.local.horarios[0];
      const ventana = h ? `${h.entrada} – ${h.salida}` : '08:00 – 18:00';
      const a = asignacionPorLocal.get(v.localId);
      const delLocal = visitas.filter((x) => x.localId === v.localId);
      const horariosLocal = horariosDe(a);
      const estado = estadoAgenda(
        delLocal,
        horariosLocal,
        ZONA_CAMPO,
        desde,
        hasta,
        ahora,
        a,
      );

      paradasMap.set(v.localId, {
        id: `visita-${v.id}`,
        localId: v.localId,
        local: nombreLocal(v.local),
        tipo: 'supermercado',
        ventana: existing?.ventana ?? ventana,
        ...estado,
        visitas: delLocal.length,
        ausencias: ausenciasAgenda(
          delLocal,
          horariosLocal,
          ZONA_CAMPO,
          desde,
          hasta,
          ahora,
          a,
        ),
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

    // Tareas por categoría: las de sus locales propios y las de los locales
    // que visitó; en un local heredado, las del equipo de su titular.
    const localIds = [
      ...new Set([
        ...asignaciones.filter(propia).map((a) => a.localId),
        ...visitas.map((v) => v.localId),
      ]),
    ];
    const equipos = new Map([[equipoUsuario.id, equipoUsuario]]);
    for (const v of visitas) {
      const a = asignacionPorLocal.get(v.localId);
      const equipo = a && !propia(a) ? a.usuario.rol?.equipoCampo : null;
      if (equipo?.activo) equipos.set(equipo.id, equipo);
    }
    const tareas = localIds.length
      ? await this.prisma.tareaCampo.findMany({
          where: {
            empresaId: u.empresaId,
            activo: true,
            fechaDesde: { lte: fechaHasta },
            OR: [{ fechaHasta: null }, { fechaHasta: { gte: fechaDesde } }],
            AND: [
              {
                OR: [...equipos.values()].map((e) => ({
                  equipoCampoId: e.id,
                  destinatario: destinatarioCampo(e),
                })),
              },
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
        })
      : [];

    const tareasCumplidasSet = new Set(
      visitas.flatMap((v) =>
        v.cumplimientos.filter((c) => c.completadaAt).map((c) => c.tareaId),
      ),
    );

    const evidencias = visitas.flatMap((visita) =>
      visita.cumplimientos.map((cumplimiento) => ({
        visitaId: visita.id,
        local: nombreLocal(visita.local),
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

    const novedadesFormat = novedades.map((n) => ({
      id: `n${n.id}`,
      novedadId: n.id,
      tipo: n.tipo,
      estado: n.estado.toLowerCase(),
      texto: n.descripcion,
      cliente: nombreLocal(n.local),
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
