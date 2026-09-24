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

  const botonBase =
    "grid h-10 min-w-10 place-items-center rounded-xl border border-control-line bg-surface-raised px-2 text-sm shadow-sm transition hover:border-brand-500 hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 disabled:cursor-not-allowed disabled:bg-surface-soft disabled:text-muted";

  return (
    <div className="flex flex-col items-center justify-between gap-3 pt-4 sm:flex-row">
      <p className="text-xs text-muted [font-variant-numeric:tabular-nums]">
        {desde}–{hasta} de {total} registros
      </p>

      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs text-muted">
          Por página
          <select
            value={limit}
            onChange={(e) => {
              if (desplazarAlInicio) volverAlInicioDelListado(e.currentTarget);
              onLimitChange(Number(e.target.value));
            }}
            className="min-h-10 rounded-xl border border-control-line bg-surface-raised px-2 py-1.5 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/55"
          >
            {OPCIONES_POR_PAGINA.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>

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
          ‹
        </button>
        <span className="text-sm [font-variant-numeric:tabular-nums]">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          onClick={(e) => {
            if (desplazarAlInicio) volverAlInicioDelListado(e.currentTarget);
            onPageChange(page + 1);
          }}
          disabled={page >= totalPages}
          aria-label="Página siguiente"
          className={botonBase}
        >
          ›
        </button>
      </div>
    </div>
  );
}
