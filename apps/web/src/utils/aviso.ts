import type { ProgramacionAvisoItem } from "@/types/campo";

export function descripcionFrecuenciaAviso(
  aviso: ProgramacionAvisoItem,
): string {
  switch (aviso.frecuencia) {
    case "HORARIA":
      return `Cada ${aviso.intervaloHoras} hora${aviso.intervaloHoras === 1 ? "" : "s"}`;
    case "DIARIA":
      return "Cada día";
    case "SEMANAL":
      return "Cada semana";
    case "MENSUAL":
      return "Cada mes";
    default:
      return "Una vez";
  }
}

/** Fecha y hora cortas de un aviso ("19 oct., 14:30"). */
export function formatearFechaAviso(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-PY", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
