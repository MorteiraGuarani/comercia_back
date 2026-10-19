"use client";

import { volverAlInicioDelListado } from "@/utils/scroll-listado";

// Paginador estándar de comercIA para TODA tabla (7 filas por defecto).
// Uso: mantener page/limit en el estado de la página y pedir a la API con
// ?page=X&limit=Y (la API responde RespuestaPaginada<T> — ver @/types/paginacion).

const OPCIONES_POR_PAGINA = [7, 15, 30];

function Flecha({ izquierda }: { izquierda?: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d={
          izquierda
            ? "M11.78 5.22a.75.75 0 010 1.06L8.06 10l3.72 3.72a.75.75 0 11-1.06 1.06l-4.25-4.25a.75.75 0 010-1.06l4.25-4.25a.75.75 0 011.06 0z"
            : "M8.22 5.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 010-1.06z"
        }
        clipRule="evenodd"
      />
    </svg>
  );
}

export function Paginacion({
  page,
  totalPages,
  total,
  limit,
  onPageChange,
  onLimitChange,
  desplazarAlInicio = true,
}: {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  desplazarAlInicio?: boolean;
}) {
  const desde = total === 0 ? 0 : (page - 1) * limit + 1;
  const hasta = Math.min(page * limit, total);
  const paginas = Math.max(1, totalPages);
  // Algunos listados arrancan con otro tamaño (ej. 25): se suma a las opciones
  // para que el selector muestre el valor real y no el primero de la lista.
  const opciones = OPCIONES_POR_PAGINA.includes(limit)
    ? OPCIONES_POR_PAGINA
    : [...OPCIONES_POR_PAGINA, limit].sort((a, b) => a - b);

  const botonFlecha =
    "grid w-11 shrink-0 cursor-pointer place-items-center text-foreground transition-colors hover:bg-surface-soft active:bg-surface-soft focus-visible:relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-600 disabled:cursor-not-allowed disabled:text-muted disabled:opacity-40 disabled:hover:bg-transparent dark:text-foreground dark:hover:bg-surface-soft dark:active:bg-surface-soft dark:disabled:text-muted";

  return (
    <nav
      aria-label="Paginación"
      className="flex min-w-0 w-full flex-wrap items-center justify-between gap-x-3 gap-y-2 pt-3"
    >
      <p className="min-w-0 text-xs text-muted [font-variant-numeric:tabular-nums] dark:text-muted">
        <span className="font-semibold text-foreground dark:text-foreground">
          {desde}–{hasta}
        </span>{" "}
        de {total}
        <span className="hidden sm:inline"> registros</span>
      </p>

      <div className="flex shrink-0 items-center gap-2">
        <label className="flex items-center gap-1.5 whitespace-nowrap text-xs text-muted dark:text-muted">
          <span className="hidden sm:inline">Por página</span>
          <select
            aria-label="Registros por página"
            value={limit}
            onChange={(e) => {
              if (desplazarAlInicio) volverAlInicioDelListado(e.currentTarget);
              onLimitChange(Number(e.target.value));
            }}
            className="h-11 cursor-pointer rounded-xl border border-control-line bg-surface-raised pl-2.5 pr-1 text-base text-foreground shadow-sm outline-none transition-colors hover:border-brand-500 focus-visible:border-brand-600 focus-visible:ring-2 focus-visible:ring-brand-600/55 sm:text-sm dark:border-control-line dark:bg-surface-raised dark:text-foreground dark:hover:border-brand-500 dark:focus-visible:border-brand-600 dark:focus-visible:ring-brand-600/55"
          >
            {opciones.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>

        {paginas > 1 ? (
          <div className="flex h-11 items-stretch overflow-hidden rounded-xl border border-control-line bg-surface-raised shadow-sm dark:border-control-line dark:bg-surface-raised">
            <button
              type="button"
              onClick={(e) => {
                if (desplazarAlInicio) volverAlInicioDelListado(e.currentTarget);
                onPageChange(page - 1);
              }}
              disabled={page <= 1}
              aria-label="Página anterior"
              className={botonFlecha}
            >
              <Flecha izquierda />
            </button>
            <span
              aria-live="polite"
              aria-label={`Página ${page} de ${paginas}`}
              className="grid min-w-14 place-items-center border-x border-control-line px-2 text-sm font-semibold text-foreground [font-variant-numeric:tabular-nums] dark:border-control-line dark:text-foreground"
            >
              <span aria-hidden="true">
                {page}
                <span className="font-normal text-muted dark:text-muted"> / {paginas}</span>
              </span>
            </span>
            <button
              type="button"
              onClick={(e) => {
                if (desplazarAlInicio) volverAlInicioDelListado(e.currentTarget);
                onPageChange(page + 1);
              }}
              disabled={page >= paginas}
              aria-label="Página siguiente"
              className={botonFlecha}
            >
              <Flecha />
            </button>
          </div>
        ) : null}
      </div>
    </nav>
  );
}
