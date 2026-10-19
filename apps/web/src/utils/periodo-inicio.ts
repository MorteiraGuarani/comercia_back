import type { PeriodoInicio } from "@/types/hoy-en-campo";
import { agregarDiasIso, lunesDeIso } from "./fechas";

export const PERIODOS_INICIO: { clave: PeriodoInicio; etiqueta: string }[] = [
  { clave: "hoy", etiqueta: "Hoy" },
  { clave: "ayer", etiqueta: "Ayer" },
  { clave: "semana", etiqueta: "Semana" },
  { clave: "mes", etiqueta: "Mes" },
];

/** Días que abarca el período (la semana y el mes, hasta hoy). */
export function rangoPeriodoInicio(
  periodo: PeriodoInicio,
  hoy: string,
): { desde: string; hasta: string } {
  if (periodo === "ayer") {
    const ayer = agregarDiasIso(hoy, -1);
    return { desde: ayer, hasta: ayer };
  }
  if (periodo === "semana") return { desde: lunesDeIso(hoy), hasta: hoy };
  if (periodo === "mes") return { desde: `${hoy.slice(0, 7)}-01`, hasta: hoy };
  return { desde: hoy, hasta: hoy };
}

/** Parámetros de fecha para la API: un día o un rango. */
export function consultaPeriodoInicio(periodo: PeriodoInicio, hoy: string): string {
  const { desde, hasta } = rangoPeriodoInicio(periodo, hoy);
  return desde === hasta ? `fecha=${desde}` : `fechaInicio=${desde}&fechaFin=${hasta}`;
}

/** "hoy", "ayer", "esta semana", "este mes": para armar frases. */
export function cuandoPeriodoInicio(periodo: PeriodoInicio): string {
  return { hoy: "hoy", ayer: "ayer", semana: "esta semana", mes: "este mes" }[periodo];
}
