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
