// Tablero "Hoy en campo" del supervisor de repositores.

export type IndicadorHoy = "presentismo" | "visitas" | "tareas" | "novedades";

export type FiltroEquipoHoy = "todos" | "atencion" | "alertas";

export type TonoHoy = "bad" | "warn" | "info" | "ok";

/** Qué abre la hoja inferior del tablero. */
export type HojaHoy =
  | { tipo: "indicador"; indicador: IndicadorHoy }
  | { tipo: "persona"; id: number }
  | { tipo: "novedad"; id: number };

/** Resumen del día de un repositor o impulsador (inicio "Tu día"). */
export interface ResumenMiDia {
  total: number;
  completadas: number;
  enCurso: number;
  pendientes: number;
  incompletas: number;
  ausentes: number;
  presentismo: import("./estado-jornada").EstadoPresentismo;
  /** ISO de la primera entrada del día, si hubo. */
  primeraEntrada: string | null;
}

/** Fila de "Atender ahora". */
export interface ItemAtencionHoy {
  clave: string;
  tono: TonoHoy;
  icono: "persona" | "alerta" | "reloj" | "tareas";
  titulo: string;
  detalle: string;
  accion: string;
  abre: HojaHoy;
}

/** Período que muestra Inicio. */
export type PeriodoInicio = "hoy" | "ayer" | "semana" | "mes";
