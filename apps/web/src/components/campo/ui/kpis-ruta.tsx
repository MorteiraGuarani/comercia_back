import type { ReactNode } from "react";
import type { FiltroRuta } from "@/types/estado-jornada";
import { pct } from "@/utils/hoy-en-campo";
import {
  IconoCheck,
  IconoPlay,
  IconoReloj,
  IconoTienda,
} from "./iconos-campo";

interface KpisRutaProps {
  total: number | string;
  visitadas: number;
  enCurso: number;
  pendientes: number;
  /** Período consultado ("hoy", "en el período"...). */
  sufijo: string;
  /** Los conteos por estado salen de la página visible, no de toda la agenda. */
  porPagina?: boolean;
  /** Cada KPI filtra la lista; "Locales" vuelve a mostrar todos. */
  filtro: FiltroRuta;
  onFiltro: (filtro: FiltroRuta) => void;
}

interface Kpi {
  filtro: FiltroRuta;
  etiqueta: string;
  valor: number | string;
  detalle: string;
  /** Parte del total de locales; sin total confiable no se muestra. */
  porcentaje: number | null;
  icono: ReactNode;
  tarjeta: string;
  circulo: string;
  activo: string;
}

export function KpisRuta({
  total,
  visitadas,
  enCurso,
  pendientes,
  sufijo,
  porPagina = false,
  filtro,
  onFiltro,
}: KpisRutaProps) {
  const detalle = porPagina ? "en esta página" : sufijo;
  // Con la agenda paginada los conteos son de la página: el % saldría mal.
  const base = typeof total === "number" && total > 0 && !porPagina ? total : null;
  const porcentaje = (n: number) => (base === null ? null : pct(n, base));
  const kpis: Kpi[] = [
    {
      filtro: "todos",
      etiqueta: "Locales",
      valor: total,
      // En Locales el % es el avance: cuántos ya se visitaron.
      detalle: base === null ? "en tu ruta" : `${pct(visitadas, base)}% visitado`,
      porcentaje: null,
      icono: <IconoTienda className="h-4 w-4 sm:h-5 sm:w-5" />,
      tarjeta:
        "border-brand-100 bg-brand-50 hover:border-brand-500 dark:border-brand-900 dark:bg-brand-950/50 dark:hover:border-brand-500",
      circulo: "bg-brand-700 text-white dark:bg-brand-500 dark:text-brand-950",
      activo: "border-brand-600 ring-2 ring-brand-600/30 dark:border-brand-500 dark:ring-brand-500/40",
    },
    {
      filtro: "pendiente",
      etiqueta: "Pendientes",
      valor: pendientes,
      detalle: !porPagina && sufijo === "hoy" ? "para hoy" : detalle,
      porcentaje: porcentaje(pendientes),
      icono: <IconoReloj className="h-4 w-4 sm:h-5 sm:w-5" />,
      tarjeta:
        "border-stone-200 bg-stone-50 hover:border-stone-400 dark:border-stone-800 dark:bg-stone-900/40 dark:hover:border-stone-500",
      circulo: "bg-stone-500 text-white dark:bg-stone-400 dark:text-stone-950",
      activo: "border-stone-500 ring-2 ring-stone-500/30 dark:border-stone-400 dark:ring-stone-400/40",
    },
    {
      filtro: "en_curso",
      etiqueta: "En curso",
      valor: enCurso,
      detalle: porPagina ? detalle : "ahora",
      porcentaje: porcentaje(enCurso),
      icono: <IconoPlay className="h-3.5 w-3.5 sm:h-4 sm:w-4" />,
      tarjeta:
        "border-sky-100 bg-sky-50 hover:border-sky-400 dark:border-sky-900 dark:bg-sky-950/40 dark:hover:border-sky-600",
      circulo: "bg-sky-600 text-white dark:bg-sky-500 dark:text-sky-950",
      activo: "border-sky-600 ring-2 ring-sky-600/30 dark:border-sky-500 dark:ring-sky-500/40",
    },
    {
      filtro: "completado",
      etiqueta: "Presentes",
      valor: visitadas,
      detalle,
      porcentaje: porcentaje(visitadas),
      icono: <IconoCheck className="h-4 w-4 sm:h-5 sm:w-5" />,
      tarjeta:
        "border-emerald-100 bg-emerald-50 hover:border-emerald-400 dark:border-emerald-900 dark:bg-emerald-950/40 dark:hover:border-emerald-600",
      circulo:
        "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950",
      activo: "border-emerald-600 ring-2 ring-emerald-600/30 dark:border-emerald-500 dark:ring-emerald-500/40",
    },
  ];

  return (
    <div className="min-w-0">
      <div
        role="group"
        aria-label="Filtrar la agenda por estado"
        className="grid min-w-0 grid-cols-4 gap-1.5 sm:gap-3"
      >
        {kpis.map((k) => {
          const seleccionado = filtro === k.filtro;
          return (
            <button
              key={k.filtro}
              type="button"
              onClick={() => onFiltro(k.filtro)}
              aria-pressed={seleccionado}
              className={`flex min-w-0 cursor-pointer flex-col rounded-xl border px-1.5 py-2 text-left transition-[border-color,box-shadow,opacity] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus sm:px-3 sm:py-3 ${k.tarjeta} ${
                seleccionado ? k.activo : filtro !== "todos" ? "opacity-70 hover:opacity-100" : ""
              }`}
            >
              <span className="flex min-w-0 items-center gap-1 sm:gap-2">
                <span
                  aria-hidden="true"
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-full sm:h-9 sm:w-9 ${k.circulo}`}
                >
                  {k.icono}
                </span>
                <span className="ft-display truncate text-xl font-bold leading-none tabular-nums text-foreground sm:text-3xl">
                  {k.valor}
                  {/* "1/2": de cuántos locales es el número. */}
                  {k.porcentaje !== null ? (
                    <small className="text-xs font-semibold text-muted sm:text-base">/{base}</small>
                  ) : null}
                </span>
              </span>
              <span className="ft-display mt-1 truncate text-xs font-semibold leading-tight text-foreground sm:mt-1.5 sm:text-sm">
                {k.etiqueta}
              </span>
              <span className="truncate text-[10px] leading-tight text-muted sm:text-xs">
                {k.porcentaje !== null ? (
                  <b className="font-semibold tabular-nums text-foreground/80">{k.porcentaje}% · </b>
                ) : null}
                {k.detalle}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
