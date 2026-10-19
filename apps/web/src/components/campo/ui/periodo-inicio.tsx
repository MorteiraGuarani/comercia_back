"use client";

import { PERIODOS_INICIO } from "@/utils/periodo-inicio";
import type { PeriodoInicio } from "@/types/hoy-en-campo";

/** Hoy · Ayer · Semana · Mes, arriba del tablero de Inicio. */
export function SelectorPeriodoInicio({
  valor,
  onCambiar,
}: {
  valor: PeriodoInicio;
  onCambiar: (periodo: PeriodoInicio) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Período"
      className="grid w-full min-w-0 grid-cols-4 gap-1 rounded-xl border border-line bg-surface-soft p-1 sm:w-auto sm:inline-grid"
    >
      {PERIODOS_INICIO.map((p) => {
        const activo = p.clave === valor;
        return (
          <button
            key={p.clave}
            type="button"
            role="radio"
            aria-checked={activo}
            onClick={() => onCambiar(p.clave)}
            className={`min-h-11 cursor-pointer whitespace-nowrap rounded-lg px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus sm:px-4 ${
              activo
                ? "bg-surface-raised text-foreground shadow-sm"
                : "text-muted hover:bg-surface-raised/60 hover:text-foreground"
            }`}
          >
            {p.etiqueta}
          </button>
        );
      })}
    </div>
  );
}
