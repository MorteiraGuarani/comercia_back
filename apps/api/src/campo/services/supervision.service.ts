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
import { fechaCampo, relojCampo } from '../utils/calendario';
import { obtenerEquipoCompleto } from '../utils/autorizacion';

@Injectable()
export class SupervisionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acceso: CampoAccesoService,
  ) {}

  private formatoHora(date: Date | string | null): string | null {
    if (!date) return null;
    const d = new Date(date);
    return d.toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
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
    const esRango = Boolean(query.fechaInicio && query.fechaFin);
    const fechaTexto = esRango
      ? `${query.fechaInicio} al ${query.fechaFin}`
      : (query.fecha ?? relojCampo().fecha);
    const fechaDesdeStr = query.fechaInicio ?? (query.fecha ?? relojCampo().fecha);
    const fechaHastaStr = query.fechaFin ?? fechaDesdeStr;
    const fechaDesde = fechaCampo(fechaDesdeStr);
    const fechaHasta = fechaCampo(fechaHastaStr);

    // Obtener los subordinados del usuario
    const equipoIds = await obtenerEquipoCompleto(this.prisma, u.id);
    const subordinadosIds = equipoIds.filter((id) => id !== u.id);

    // Si el usuario no tiene subordinados pero es team leader/admin de empresa,
    // buscamos usuarios de la misma empresa con rol inferior o subordinados
    const idsConsultar = subordinadosIds.length > 0 ? subordinadosIds : [u.id];

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
        rol: { select: { descripcion: true } },
      },
      orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
    });

    const colaboradores: ColaboradorResumenItem[] = [];

    let totalRutaAsignada = 0;
    let totalRutaCompletada = 0;
    let totalRutaEnCurso = 0;

    let totalTareasGlobal = 0;
    let totalTareasCompletadasGlobal = 0;
    let totalObligatoriasPendientesGlobal = 0;

    let enRutaCount = 0;
    let finalizadosCount = 0;
    let sinIniciarCount = 0;

    for (const user of usuarios) {
      // Asignaciones del colaborador para el período
      const asignaciones = await this.prisma.asignacionCampo.findMany({
        where: {
          activo: true,
          fechaDesde: { lte: fechaHasta },
          local: { activo: true, cliente: { empresaId: u.empresaId, activo: true } },
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
        select: {
          id: true,
          localId: true,
        },
      });

      // Visitas registradas en el período por el usuario
      const visitasHoy = await this.prisma.visitaCampo.findMany({
        where: {
          usuarioId: user.id,
          fecha: esRango ? { gte: fechaDesde, lte: fechaHasta } : fechaDesde,
        },
        include: {
          cumplimientos: {
            where: { NOT: { completadaAt: null } },
            select: { tareaId: true },
          },
        },
        orderBy: { entrada: 'asc' },
      });

      // Calcular asistencias e In/Out
      let asistencia: 'en_curso' | 'finalizado' | 'sin_iniciar' = 'sin_iniciar';
      let inicioJornada: string | null = null;
      let finJornada: string | null = null;

      const visitaAbierta = visitasHoy.find((v) => v.salida === null);

      if (visitaAbierta) {
        asistencia = 'en_curso';
      } else if (visitasHoy.length > 0) {
        asistencia = 'finalizado';
      } else {
        asistencia = 'sin_iniciar';
      }

      if (visitasHoy.length > 0) {
        inicioJornada = this.formatoHora(visitasHoy[0].entrada);
        if (asistencia === 'finalizado') {
          finJornada = this.formatoHora(visitasHoy[visitasHoy.length - 1].salida);
        }
      }

      if (asistencia === 'en_curso') enRutaCount++;
      else if (asistencia === 'finalizado') finalizadosCount++;
      else sinIniciarCount++;

      // Métricas de ruta del colaborador
      const totalVisitas = Math.max(asignaciones.length, visitasHoy.length);
      const completadasVisitas = visitasHoy.filter((v) => v.salida !== null).length;
      const enCursoVisitas = visitaAbierta ? 1 : 0;
      const pctRuta = totalVisitas ? Math.round((completadasVisitas / totalVisitas) * 100) : 0;

      totalRutaAsignada += totalVisitas;
      totalRutaCompletada += completadasVisitas;
      totalRutaEnCurso += enCursoVisitas;

      // Métricas de tareas del colaborador
      const localIds = Array.from(
        new Set([...asignaciones.map((a) => a.localId), ...visitasHoy.map((v) => v.localId)]),
      );

      const tareasAplicables = await this.prisma.tareaCampo.findMany({
        where: {
          empresaId: u.empresaId,
          activo: true,
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
      const completadasTareas = tareasAplicables.filter((t) => cumplimientosIds.has(t.id)).length;
      const obligPendientes = tareasAplicables.filter(
        (t) => t.esObligatoria && !cumplimientosIds.has(t.id),
      ).length;
      const pctTareas = totalTareas ? Math.round((completadasTareas / totalTareas) * 100) : 0;

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

      const iniciales = `${user.nombre[0] ?? ''}${user.apellido[0] ?? ''}`.toUpperCase();

      colaboradores.push({
        id: user.id,
        nombre: `${user.nombre} ${user.apellido}`,
        iniciales,
        zona: user.rol?.descripcion ?? 'Comercial',
        telefono: user.celular || '—',
        asistencia,
        inicioJornada,
        finJornada,
        ruta: {
          total: totalVisitas,
          completadas: completadasVisitas,
          enCurso: enCursoVisitas,
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

    return {
      fecha: fechaTexto,
      presentismo: {
        enRuta: enRutaCount,
        finalizados: finalizadosCount,
        sinIniciar: sinIniciarCount,
        totalEquipo: usuarios.length,
      },
      rutas: {
        total: totalRutaAsignada,
        completadas: totalRutaCompletada,
        enCurso: totalRutaEnCurso,
        pendientes: Math.max(0, totalRutaAsignada - totalRutaCompletada - totalRutaEnCurso),
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
    const fechaTexto = query.fecha ?? relojCampo().fecha;
    const fecha = fechaCampo(fechaTexto);

    const equipoIds = await obtenerEquipoCompleto(this.prisma, u.id);
    if (!equipoIds.includes(colaboradorId) && colaboradorId !== u.id) {
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
        rol: { select: { descripcion: true } },
      },
    });

    if (!user) {
      throw new NotFoundException('Colaborador no encontrado');
    }

    // Asignaciones del colaborador para hoy
    const asignaciones = await this.prisma.asignacionCampo.findMany({
      where: {
        activo: true,
        fechaDesde: { lte: fecha },
        local: { activo: true, cliente: { empresaId: u.empresaId, activo: true } },
        AND: [
          { OR: [{ fechaHasta: null }, { fechaHasta: { gte: fecha } }] },
          {
            OR: [
              { usuarioId: user.id },
              {
                backups: {
                  some: {
                    usuarioId: user.id,
                    activo: true,
                    fechaDesde: { lte: fecha },
                    fechaHasta: { gte: fecha },
                  },
                },
              },
            ],
          },
        ],
      },
      include: {
        local: {
          include: {
            cliente: { select: { id: true, nombre: true } },
            horarios: {
              where: { activo: true },
              select: { entrada: true, salida: true, id: true },
              orderBy: { entrada: 'asc' },
              take: 5,
            },
          },
        },
      },
    });

    // Visitas de hoy
    const visitas = await this.prisma.visitaCampo.findMany({
      where: {
        usuarioId: user.id,
        fecha,
      },
      include: {
        local: {
          include: {
            cliente: { select: { id: true, nombre: true } },
            horarios: {
              where: { activo: true },
              select: { entrada: true, salida: true, id: true },
              orderBy: { entrada: 'asc' },
              take: 5,
            },
          },
        },
        cumplimientos: {
          where: { NOT: { completadaAt: null } },
          select: { tareaId: true },
        },
      },
      orderBy: { entrada: 'asc' },
    });

    // Armar la ruta del día ordenada
    const paradasMap = new Map<number, ParadaRuta>();

    // Primero asignaciones
    for (const a of asignaciones) {
      const h = a.local.horarios[0];
      const ventana = h ? `${h.entrada} – ${h.salida}` : '08:00 – 18:00';
      paradasMap.set(a.local.id, {
        id: `local-${a.local.id}`,
        localId: a.local.id,
        cliente: a.local.cliente.nombre,
        local: a.local.nombre,
        tipo: 'supermercado', // default semántico
        ventana,
        estado: 'pendiente',
        checkin: null,
        checkout: null,
      });
    }

    // Actualizar con visitas reales
    for (const v of visitas) {
      const existing = paradasMap.get(v.local.id);
      const h = v.local.horarios[0];
      const ventana = h ? `${h.entrada} – ${h.salida}` : '08:00 – 18:00';
      const estado: ParadaRuta['estado'] = v.salida
        ? 'completado'
        : 'en_curso';

      paradasMap.set(v.local.id, {
        id: `visita-${v.id}`,
        localId: v.local.id,
        cliente: v.local.cliente.nombre,
        local: v.local.nombre,
        tipo: 'supermercado',
        ventana: existing?.ventana ?? ventana,
        estado,
        checkin: this.formatoHora(v.entrada),
        checkout: this.formatoHora(v.salida),
      });
    }

    const ruta = Array.from(paradasMap.values());

    // Asistencia
    const tieneEnCurso = visitas.some((v) => !v.salida);
    const asistencia = tieneEnCurso
      ? 'en_curso'
      : visitas.length > 0
        ? 'finalizado'
        : 'sin_iniciar';

    const inicioJornada = visitas.length > 0 ? this.formatoHora(visitas[0].entrada) : null;
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
        fechaDesde: { lte: fecha },
        OR: [{ fechaHasta: null }, { fechaHasta: { gte: fecha } }],
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
      visitas.flatMap((v) => v.cumplimientos.map((c) => c.tareaId)),
    );

    // Agrupar por categoría
    const categoriasMap = new Map<string, { total: number; completadas: number; obligPendiente: boolean; tareas: any[] }>();

    for (const t of tareas) {
      const cat = t.categoria || 'Relevamiento';
      const curr = categoriasMap.get(cat) ?? { total: 0, completadas: 0, obligPendiente: false, tareas: [] };
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

    const tareasCategorias = Array.from(categoriasMap.entries()).map(([categoria, datos]) => ({
      categoria,
      ...datos,
    }));

    // Novedades de hoy
    const novedades = await this.prisma.novedadCampo.findMany({
      where: {
        usuarioId: user.id,
        creadoAt: {
          gte: new Date(fechaTexto + 'T00:00:00.000Z'),
          lte: new Date(fechaTexto + 'T23:59:59.999Z'),
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

    const iniciales = `${user.nombre[0] ?? ''}${user.apellido[0] ?? ''}`.toUpperCase();

    return {
      colaborador: {
        id: user.id,
        nombre: `${user.nombre} ${user.apellido}`,
        iniciales,
        zona: user.rol?.descripcion ?? 'Comercial',
        telefono: user.celular || '—',
        email: user.correo,
        asistencia,
        inicioJornada,
        finJornada,
      },
      ruta,
      tareasCategorias,
      novedades: novedadesFormat,
    };
  }
}
