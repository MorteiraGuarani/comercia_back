// Helpers de fechas (funciones puras).
//
export function fechaInputAIso(fecha: string): string | null {
  if (!fecha) return null;
  const d = new Date(fecha);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function isoAFechaInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function formatoFecha(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-PY", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatoHora(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit" });
}

export function formatoFechaHora(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${formatoFecha(iso)} ${formatoHora(iso)}`;
}

/** Hora si es de hoy ("10:42"); si no, día y mes ("18 oct"). */
export function horaOFechaCorta(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toDateString() === new Date().toDateString()
    ? formatoHora(iso)
    : d.toLocaleDateString("es-PY", { day: "numeric", month: "short" });
}

/** "1 oct 2026" para una fecha de calendario (YYYY-MM-DD o ISO), sin correr de día por zona horaria. */
export function formatoFechaCalendario(valor: string | null | undefined): string | null {
  const dia = fechaCalendario(valor);
  if (!dia) return null;
  return new Date(`${dia}T12:00:00`).toLocaleDateString("es-PY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** "Lunes, 19 de octubre" para un YYYY-MM-DD de calendario. */
export function formatoDiaLargo(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00`);
  if (Number.isNaN(d.getTime())) return fecha;
  const texto = d.toLocaleDateString("es-PY", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Texto corto de un rango de calendario: un día largo o "13 oct – 19 oct". */
export function textoRangoFechas(inicio: string, fin: string): string {
  if (inicio === fin) return formatoDiaLargo(inicio);
  const corto = (f: string) =>
    new Date(`${f}T12:00:00`).toLocaleDateString("es-PY", {
      day: "numeric",
      month: "short",
    });
  return `${corto(inicio)} – ${corto(fin)}`;
}

export function fechaEnZonaIso(
  fecha: Date,
  zonaHoraria = "America/Asuncion",
): string {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: zonaHoraria,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(fecha);
  const valor = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((parte) => parte.type === tipo)?.value ?? "";
  return `${valor("year")}-${valor("month")}-${valor("day")}`;
}

/** YYYY-MM-DD de calendario, o null si viene vacío. Recorta un ISO largo. */
export function fechaCalendario(valor: string | null | undefined): string | null {
  if (valor == null) return null;
  const texto = valor.trim();
  if (!texto) return null;
  const dia = texto.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(dia) ? dia : null;
}

export function agregarDiasIso(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Lunes de la semana ISO (lunes a domingo) que contiene `fecha`. */
export function lunesDeIso(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00.000Z`);
  const isoDow = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  return agregarDiasIso(fecha, 1 - isoDow);
}

export function queryFechasCampo(periodo: {
  fecha?: string;
  fechaInicio?: string;
  fechaFin?: string;
}): string {
  const inicio = periodo.fechaInicio ?? periodo.fecha;
  const fin = periodo.fechaFin ?? periodo.fecha;
  if (inicio && fin && inicio !== fin) {
    return `fechaInicio=${encodeURIComponent(inicio)}&fechaFin=${encodeURIComponent(fin)}`;
  }
  const unica = inicio ?? fin;
  return unica ? `fecha=${encodeURIComponent(unica)}` : "";
}
