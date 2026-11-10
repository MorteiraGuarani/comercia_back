"use client";

import { useRef } from "react";

const boton =
  "inline-flex min-h-11 min-w-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus";

/** "Ver más" de una lista en tandas (`usePorTandas`) y "Ocultar" para volver a la primera. */
export function BotonTandas({
  restantes,
  expandida,
  tanda = 5,
  controla,
  onVerMas,
  onOcultar,
}: {
  restantes: number;
  expandida: boolean;
  tanda?: number;
  /** id de la lista que se expande. */
  controla?: string;
  onVerMas: () => void;
  onOcultar: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  if (!restantes && !expandida) return null;
  return (
    <div ref={ref} className="flex min-w-0 gap-2">
      {restantes > 0 ? (
        <button
          type="button"
          aria-controls={controla}
          onClick={onVerMas}
          className={`${boton} flex-1 border-line bg-surface-raised text-foreground hover:border-brand-500 hover:bg-surface-soft`}
        >
          Ver {Math.min(tanda, restantes)} más
          <span className="font-normal tabular-nums text-muted">· quedan {restantes}</span>
        </button>
      ) : null}
      {expandida ? (
        <button
          type="button"
          aria-controls={controla}
          onClick={() => {
            onOcultar();
            // La lista se achica: que el botón no quede lejos, fuera de la pantalla.
            requestAnimationFrame(() => ref.current?.scrollIntoView({ block: "nearest" }));
          }}
          className={`${boton} ${restantes > 0 ? "" : "flex-1"} border-transparent text-accent-ink hover:border-line hover:bg-surface-soft`}
        >
          Ocultar
        </button>
      ) : null}
    </div>
  );
}
