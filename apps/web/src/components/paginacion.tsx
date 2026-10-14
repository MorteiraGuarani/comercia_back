"use client";

import { volverAlInicioDelListado } from "@/utils/scroll-listado";

// Paginador estándar de comercIA para TODA tabla (7 filas por defecto).
// Uso: mantener page/limit en el estado de la página y pedir a la API con
// ?page=X&limit=Y (la API responde RespuestaPaginada<T> — ver @/types/paginacion).

const OPCIONES_POR_PAGINA = [7, 15, 30];

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

  const botonBase =
    "grid h-11 min-w-11 shrink-0 cursor-pointer place-items-center rounded-xl border border-control-line bg-surface-raised px-2 text-xl text-foreground shadow-sm transition-colors hover:border-brand-500 hover:bg-surface-soft active:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 disabled:cursor-not-allowed disabled:bg-surface-soft disabled:text-muted disabled:opacity-50 dark:border-control-line dark:bg-surface-raised dark:text-foreground dark:hover:border-brand-500 dark:hover:bg-surface-soft dark:active:bg-surface-soft dark:disabled:bg-surface-soft dark:disabled:text-muted";

  return (
    <nav aria-label="Paginación" className="grid min-w-0 w-full gap-2 pt-3 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
      <div className="flex min-w-0 w-full items-center justify-between gap-2 sm:w-auto sm:flex-1">
        <p className="min-w-0 break-words text-xs text-muted [font-variant-numeric:tabular-nums] dark:text-muted">
          {desde}–{hasta} de {total} registros
        </p>
        <label className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs text-muted dark:text-muted">
          <span className="sm:hidden">Mostrar</span>
          <span className="hidden sm:inline">Por página</span>
          <select
            aria-label="Registros por página"
            value={limit}
            onChange={(e) => {
              if (desplazarAlInicio) volverAlInicioDelListado(e.currentTarget);
              onLimitChange(Number(e.target.value));
            }}
            className="min-h-11 cursor-pointer rounded-xl border border-control-line bg-surface-raised px-2 py-1.5 text-base text-foreground outline-none transition-colors hover:border-brand-500 focus-visible:border-brand-600 focus-visible:ring-2 focus-visible:ring-brand-600/55 sm:text-sm dark:border-control-line dark:bg-surface-raised dark:text-foreground dark:hover:border-brand-500 dark:focus-visible:border-brand-600 dark:focus-visible:ring-brand-600/55"
          >
            {OPCIONES_POR_PAGINA.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid min-w-0 w-full grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-2 sm:w-auto sm:grid-cols-[2.75rem_auto_2.75rem]">
        <button
          type="button"
          onClick={(e) => {
            if (desplazarAlInicio) volverAlInicioDelListado(e.currentTarget);
            onPageChange(page - 1);
          }}
          disabled={page <= 1}
          aria-label="Página anterior"
          className={botonBase}
        >
          <span aria-hidden="true">‹</span>
        </button>
        <span aria-live="polite" aria-label={`Página ${page} de ${paginas}`} title={`Página ${page} de ${paginas}`} className="min-w-0 truncate text-center text-sm text-foreground [font-variant-numeric:tabular-nums] dark:text-foreground">
          {page} / {paginas}
        </span>
        <button
          type="button"
          onClick={(e) => {
            if (desplazarAlInicio) volverAlInicioDelListado(e.currentTarget);
            onPageChange(page + 1);
          }}
          disabled={page >= paginas}
          aria-label="Página siguiente"
          className={botonBase}
        >
          <span aria-hidden="true">›</span>
        </button>
      </div>
    </nav>
  );
}
