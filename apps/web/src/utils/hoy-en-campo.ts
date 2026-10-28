// Cálculos del tablero "Hoy en campo" (funciones puras).
import type {
  AgendaCampo,
  ColaboradorResumen,
  NovedadCampoItem,
  SupervisionResumenData,
} from "@/types/campo";
import type { EstadoPresentismo } from "@/types/estado-jornada";
import type {
  DiaJornadas,
  FiltroEquipoHoy,
  ItemAtencionHoy,
  ResumenMiDia,
} from "@/types/hoy-en-campo";
import { horaOFechaCorta } from "./fechas";

/** Prioridad para ordenar el equipo: primero quien necesita atención. */
const PRIORIDAD_PRESENTISMO: Record<EstadoPresentismo, number> = {
  AUSENTE: 0,
  INCOMPLETO: 1,
  EN_CURSO: 2,
  SIN_REGISTRO: 3,
  PRESENTE: 4,
};

export const pct = (parte: number, total: number) =>
  total ? Math.round((parte / total) * 100) : 0;

export function primerNombre(nombreCompleto: string) {
  return nombreCompleto.trim().split(/\s+/)[0] ?? nombreCompleto;
}

export function requiereAtencion(c: ColaboradorResumen) {
  return (
    c.estadoPresentismo === "AUSENTE" ||
    c.estadoPresentismo === "INCOMPLETO" ||
    c.tareas.obligPendientes > 0
  );
}

export function conAlertas(c: ColaboradorResumen) {
  return c.novedadesCount > 0 || c.ruta.ausentes > 0 || c.ruta.incompletas > 0;
}

export function filtrarEquipo(
  equipo: ColaboradorResumen[],
  filtro: FiltroEquipoHoy,
) {
  if (filtro === "atencion") return equipo.filter(requiereAtencion);
  if (filtro === "alertas") return equipo.filter(conAlertas);
  return equipo;
}

/** Quién entra en cada KPI del detalle "Mi Ruta" de Inicio. */
export const FILTROS_RUTA: Record<string, (c: ColaboradorResumen) => boolean> = {
  hechas: (c) => c.ruta.completadas > 0,
  en_curso: (c) => c.ruta.enCurso > 0,
  pendientes: (c) =>
    c.ruta.total - c.ruta.completadas - c.ruta.enCurso - c.ruta.incompletas - c.ruta.ausentes > 0,
  sin_visitar: (c) => c.ruta.ausentes + c.ruta.incompletas > 0,
};

/** Quién entra en cada KPI del detalle "Tareas" de Inicio. */
export const FILTROS_TAREAS: Record<string, (c: ColaboradorResumen) => boolean> = {
  hechas: (c) => c.tareas.completadas > 0,
  pendientes: (c) => c.tareas.total > c.tareas.completadas,
  obligatorias: (c) => c.tareas.obligPendientes > 0,
};

/** Sin KPI elegido (o con uno desconocido) devuelve el equipo completo. */
export function filtrarPorConteo(
  equipo: ColaboradorResumen[],
  filtros: Record<string, (c: ColaboradorResumen) => boolean>,
  clave: string | null,
) {
  const cumple = clave ? filtros[clave] : undefined;
  return cumple ? equipo.filter(cumple) : equipo;
}

export function ordenarEquipo(equipo: ColaboradorResumen[]) {
  return [...equipo].sort(
    (a, b) =>
      PRIORIDAD_PRESENTISMO[a.estadoPresentismo] -
        PRIORIDAD_PRESENTISMO[b.estadoPresentismo] ||
      a.ruta.pct - b.ruta.pct ||
      a.nombre.localeCompare(b.nombre),
  );
}

/** Visitas propias del período agrupadas por día (el más reciente primero), con su duración. */
export function jornadasPorDia(agendas: AgendaCampo[]): DiaJornadas[] {
  const dias = new Map<string, DiaJornadas["visitas"]>();
  for (const a of agendas)
    for (const v of a.visitas) {
      const fecha = v.fecha.slice(0, 10);
      dias.set(fecha, [
        ...(dias.get(fecha) ?? []),
        {
          id: v.id,
          local: a.local.nombre,
          entrada: v.entrada,
          salida: v.salida,
          estado: v.estado,
          estadoPresentismo: v.estadoPresentismo,
          minutos: v.salida ? (Date.parse(v.salida) - Date.parse(v.entrada)) / 60_000 : null,
        },
      ]);
    }
  return [...dias.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([fecha, visitas]) => ({
      fecha,
      visitas: visitas.sort((x, y) => x.entrada.localeCompare(y.entrada)),
    }));
}

/** Totales del día propio a partir de la agenda (inicio del personal de campo). */
export function resumenMiDia(agendas: AgendaCampo[]): ResumenMiDia {
  const cuenta = (estado: AgendaCampo["estado"]) =>
    agendas.filter((a) => a.estado === estado).length;
  const estados = agendas.map((a) => a.estadoPresentismo);
  // Misma prioridad que el supervisor (resumirPresentismo de la API).
  const presentismo: EstadoPresentismo =
    (["EN_CURSO", "INCOMPLETO", "AUSENTE", "PRESENTE"] as const).find((e) =>
      estados.includes(e),
    ) ?? "SIN_REGISTRO";
  const entradas = agendas
    .flatMap((a) => a.visitas.map((v) => v.entrada))
    .filter(Boolean)
    .sort();
  return {
    total: agendas.length,
    completadas: cuenta("completado"),
    enCurso: cuenta("en_curso"),
    pendientes: cuenta("pendiente"),
    incompletas: cuenta("incompleto"),
    ausentes: cuenta("ausente"),
    presentismo,
    primeraEntrada: entradas[0] ?? null,
  };
}

/** Lista corta de lo que el supervisor tendría que resolver primero. */
export function itemsAtenderAhora(
  resumen: SupervisionResumenData,
  novedades: NovedadCampoItem[],
): ItemAtencionHoy[] {
  const items: ItemAtencionHoy[] = [];
  const equipo = resumen.colaboradores;

  for (const c of equipo.filter((x) => x.estadoPresentismo === "AUSENTE")) {
    items.push({
      clave: `ausente-${c.id}`,
      tono: "bad",
      icono: "persona",
      titulo: `${c.nombre} sin entrada`,
      detalle: c.ruta.total
        ? `${c.ruta.total} ${c.ruta.total === 1 ? "local" : "locales"} de su agenda sin cubrir`
        : "Sin marcación registrada hoy",
      accion: "Ver",
      abre: { tipo: "persona", id: c.id },
    });
  }

  for (const n of novedades
    .filter((x) => x.prioridad === "CRITICA" || x.prioridad === "ALTA")
    .slice(0, 3)) {
    items.push({
      clave: `novedad-${n.id}`,
      tono: n.prioridad === "CRITICA" ? "bad" : "warn",
      icono: "alerta",
      titulo: n.titulo,
      detalle: `${n.local.nombre} · ${n.usuario.nombre} ${horaOFechaCorta(n.creadoAt)}`,
      accion: "Ver",
      abre: { tipo: "novedad", id: n.id },
    });
  }

  for (const c of equipo.filter((x) => x.estadoPresentismo === "INCOMPLETO")) {
    items.push({
      clave: `incompleto-${c.id}`,
      tono: "warn",
      icono: "reloj",
      titulo: `${c.nombre} con visita sin salida`,
      detalle: `${c.ruta.incompletas || 1} ${c.ruta.incompletas > 1 ? "visitas quedaron" : "visita quedó"} abierta${c.ruta.incompletas > 1 ? "s" : ""}`,
      accion: "Ver",
      abre: { tipo: "persona", id: c.id },
    });
  }

  const oblig = resumen.tareas.obligatoriasPendientes;
  if (oblig > 0) {
    const porPersona = equipo
      .filter((c) => c.tareas.obligPendientes > 0)
      .sort((a, b) => b.tareas.obligPendientes - a.tareas.obligPendientes)
      .slice(0, 3)
      .map((c) => `${c.tareas.obligPendientes} de ${primerNombre(c.nombre)}`);
    items.push({
      clave: "obligatorias",
      tono: "warn",
      icono: "tareas",
      titulo: `${oblig} ${oblig === 1 ? "tarea obligatoria pendiente" : "tareas obligatorias pendientes"}`,
      detalle: porPersona.join(" · "),
      accion: "Ver",
      abre: { tipo: "indicador", indicador: "tareas" },
    });
  }

  return items;
}
