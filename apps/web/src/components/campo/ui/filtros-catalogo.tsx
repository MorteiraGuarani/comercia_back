import type { ReactNode } from "react";
import { IconoBuscar, IconoCruz } from "./iconos-campo";

// Encabezado de los catálogos (locales, clientes, tareas): indicadores que
// filtran al tocarlos, buscador con la lupa adentro y chips desplazables.

export type TonoKpi = "marca" | "verde" | "gris" | "ambar" | "celeste" | "rojo";

const TONOS: Record<TonoKpi, { tarjeta: string; circulo: string; activo: string }> = {
  marca: {
    tarjeta: "border-brand-100 bg-brand-50 hover:border-brand-500 dark:border-brand-900 dark:bg-brand-950/50 dark:hover:border-brand-500",
    circulo: "bg-brand-700 text-white dark:bg-brand-500 dark:text-brand-950",
    activo: "border-brand-600 ring-2 ring-brand-600/30 dark:border-brand-500 dark:ring-brand-500/40",
  },
  verde: {
    tarjeta: "border-emerald-100 bg-emerald-50 hover:border-emerald-400 dark:border-emerald-900 dark:bg-emerald-950/40 dark:hover:border-emerald-600",
    circulo: "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950",
    activo: "border-emerald-600 ring-2 ring-emerald-600/30 dark:border-emerald-500 dark:ring-emerald-500/40",
  },
  gris: {
    tarjeta: "border-stone-200 bg-stone-50 hover:border-stone-400 dark:border-stone-800 dark:bg-stone-900/40 dark:hover:border-stone-500",
    circulo: "bg-stone-500 text-white dark:bg-stone-400 dark:text-stone-950",
    activo: "border-stone-500 ring-2 ring-stone-500/30 dark:border-stone-400 dark:ring-stone-400/40",
  },
  ambar: {
    tarjeta: "border-amber-100 bg-amber-50 hover:border-amber-400 dark:border-amber-900 dark:bg-amber-950/40 dark:hover:border-amber-600",
    circulo: "bg-amber-500 text-white dark:bg-amber-400 dark:text-amber-950",
    activo: "border-amber-500 ring-2 ring-amber-500/30 dark:border-amber-400 dark:ring-amber-400/40",
  },
  celeste: {
    tarjeta: "border-sky-100 bg-sky-50 hover:border-sky-400 dark:border-sky-900 dark:bg-sky-950/40 dark:hover:border-sky-600",
    circulo: "bg-sky-600 text-white dark:bg-sky-500 dark:text-sky-950",
    activo: "border-sky-600 ring-2 ring-sky-600/30 dark:border-sky-500 dark:ring-sky-500/40",
  },
  rojo: {
    tarjeta: "border-red-100 bg-red-50 hover:border-red-400 dark:border-red-900 dark:bg-red-950/40 dark:hover:border-red-600",
    circulo: "bg-red-600 text-white dark:bg-red-500 dark:text-red-950",
    activo: "border-red-600 ring-2 ring-red-600/30 dark:border-red-500 dark:ring-red-500/40",
  },
};

const COLUMNAS: Record<number, string> = {
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
};

export interface KpiFiltroItem<T extends string> {
  clave: T;
  etiqueta: string;
  valor: number | string;
  detalle?: string;
  icono: ReactNode;
  tono: TonoKpi;
}

/** Indicadores tocables: el elegido queda remarcado y filtra la lista. */
export function KpisFiltro<T extends string>({
  items,
  seleccionado,
  onSeleccionar,
  etiqueta,
}: {
  items: KpiFiltroItem<T>[];
  seleccionado: T;
  onSeleccionar: (clave: T) => void;
  etiqueta: string;
}) {
  const hayFiltro = seleccionado !== items[0]?.clave;
  return (
    <div
      role="group"
      aria-label={etiqueta}
      className={`grid min-w-0 gap-1.5 sm:gap-3 ${COLUMNAS[items.length] ?? "grid-cols-4"}`}
    >
      {items.map((k) => {
        const activo = seleccionado === k.clave;
        const tono = TONOS[k.tono];
        return (
          <button
            key={k.clave}
            type="button"
            aria-pressed={activo}
            onClick={() => onSeleccionar(k.clave)}
            className={`flex min-w-0 cursor-pointer flex-col rounded-xl border px-1.5 py-2 text-left transition-[border-color,box-shadow,opacity] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus sm:px-3 sm:py-3 ${tono.tarjeta} ${
              activo ? tono.activo : hayFiltro ? "opacity-70 hover:opacity-100" : ""
            }`}
          >
            <span className="flex min-w-0 items-center gap-1 sm:gap-2">
              <span
                aria-hidden="true"
                className={`grid h-6 w-6 shrink-0 place-items-center rounded-full sm:h-9 sm:w-9 [&_svg]:h-3.5 [&_svg]:w-3.5 sm:[&_svg]:h-[18px] sm:[&_svg]:w-[18px] ${tono.circulo}`}
              >
                {k.icono}
              </span>
              <span className="ft-display truncate text-xl font-bold leading-none tabular-nums text-foreground sm:text-3xl">
                {k.valor}
              </span>
            </span>
            <span className="ft-display mt-1 truncate text-xs font-semibold leading-tight text-foreground sm:mt-1.5 sm:text-sm">
              {k.etiqueta}
            </span>
            {k.detalle ? (
              <span className="hidden truncate text-xs leading-tight text-muted sm:block">{k.detalle}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** Buscador con la lupa adentro y botón para limpiar. */
export function BuscadorCatalogo({
  valor,
  onCambio,
  placeholder,
  etiqueta,
}: {
  valor: string;
  onCambio: (valor: string) => void;
  placeholder: string;
  etiqueta: string;
}) {
  return (
    <div className="relative min-w-0 flex-1">
      <IconoBuscar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      <input
        type="search"
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        placeholder={placeholder}
        aria-label={etiqueta}
        autoComplete="off"
        className="h-11 w-full min-w-0 rounded-xl border border-line bg-surface-raised pl-9 pr-10 text-base text-foreground outline-none transition-colors placeholder:text-muted hover:border-brand-500 focus-visible:border-brand-600 focus-visible:ring-2 focus-visible:ring-brand-600/30 sm:text-sm [&::-webkit-search-cancel-button]:hidden"
      />
      {valor ? (
        <button
          type="button"
          onClick={() => onCambio("")}
          aria-label="Limpiar búsqueda"
          title="Limpiar búsqueda"
          className="absolute inset-y-0 right-0 grid w-10 cursor-pointer place-items-center rounded-r-xl text-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <IconoCruz className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}

/** Chips de una sola elección, desplazables en celular. */
export function ChipsFiltro<T extends string>({
  opciones,
  seleccionado,
  onSeleccionar,
  etiqueta,
}: {
  opciones: { clave: T; etiqueta: string }[];
  seleccionado: T;
  onSeleccionar: (clave: T) => void;
  etiqueta: string;
}) {
  return (
    <div
      role="group"
      aria-label={etiqueta}
      className="-mx-4 flex min-w-0 gap-1.5 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden"
    >
      {opciones.map((o) => {
        const activo = seleccionado === o.clave;
        return (
          <button
            key={o.clave}
            type="button"
            aria-pressed={activo}
            onClick={() => onSeleccionar(o.clave)}
            className={`min-h-9 shrink-0 cursor-pointer whitespace-nowrap rounded-full border px-3.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
              activo
                ? "border-foreground bg-foreground text-background"
                : "border-line bg-surface-raised text-muted hover:border-brand-500 hover:text-foreground"
            }`}
          >
            {o.etiqueta}
          </button>
        );
      })}
    </div>
  );
}
