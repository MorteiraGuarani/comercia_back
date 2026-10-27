import type { PeriodoFiltro } from "@/types/periodo-filtro";
import { agregarDiasIso } from "./fechas";

/** Rangos compartidos por Inicio, Mi Ruta, Presentismo y Tareas. */
export function periodosDesdeHoy(hoy: string): PeriodoFiltro[] {
  const ayer = agregarDiasIso(hoy, -1);
  const primerDiaMes = `${hoy.slice(0, 7)}-01`;
  const ultimoDiaMesPasado = agregarDiasIso(primerDiaMes, -1);
  return [
    { clave: "hoy", etiqueta: "Hoy", fecha: hoy, fechaInicio: hoy, fechaFin: hoy },
    { clave: "ayer", etiqueta: "Ayer", fecha: ayer, fechaInicio: ayer, fechaFin: ayer },
    { clave: "ultimos_7", etiqueta: "7 días", fechaInicio: agregarDiasIso(hoy, -6), fechaFin: hoy },
    { clave: "este_mes", etiqueta: "Mes", fechaInicio: primerDiaMes, fechaFin: hoy },
    { clave: "mes_pasado", etiqueta: "Mes Pasado", fechaInicio: `${ultimoDiaMesPasado.slice(0, 7)}-01`, fechaFin: ultimoDiaMesPasado },
  ];
}

export function periodoInicioHoy(hoy: string): PeriodoFiltro {
  return periodosDesdeHoy(hoy)[0];
}

/** Días que abarca el período (la semana y el mes, hasta hoy). */
export function rangoPeriodoInicio(
  periodo: PeriodoFiltro,
  hoy: string,
): { desde: string; hasta: string } {
  const actual = periodosDesdeHoy(hoy).find((p) => p.clave === periodo.clave) ?? periodo;
  return {
    desde: actual.fechaInicio ?? actual.fecha ?? hoy,
    hasta: actual.fechaFin ?? actual.fecha ?? hoy,
  };
}

/** Parámetros de fecha para la API: un día o un rango. */
export function consultaPeriodoInicio(periodo: PeriodoFiltro, hoy: string): string {
  const { desde, hasta } = rangoPeriodoInicio(periodo, hoy);
  return desde === hasta ? `fecha=${desde}` : `fechaInicio=${desde}&fechaFin=${hasta}`;
}

/** "hoy", "ayer", "los últimos 7 días", "este mes": para armar frases. */
export function cuandoPeriodoInicio(periodo: PeriodoFiltro): string {
  const etiquetas: Record<string, string> = {
    hoy: "hoy", ayer: "ayer", ultimos_7: "los últimos 7 días", este_mes: "este mes", mes_pasado: "el mes pasado",
  };
  return etiquetas[periodo.clave] ?? "en el período seleccionado";
}
