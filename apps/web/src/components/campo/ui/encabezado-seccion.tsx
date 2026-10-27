"use client";

import { useId, useState, type ReactNode } from "react";

/** Título de sección: la explicación queda detrás del botón (i) y la acción (+) a la derecha. */
export function EncabezadoSeccion({
  titulo,
  info,
  accion,
}: {
  titulo: ReactNode;
  info: ReactNode;
  accion?: ReactNode;
}) {
  const [abierta, setAbierta] = useState(false);
  const id = useId();
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-center gap-1">
        <h4 className="min-w-0 text-sm font-bold uppercase tracking-wider text-foreground">
          {titulo}
        </h4>
        <button
          type="button"
          onClick={() => setAbierta(!abierta)}
          aria-expanded={abierta}
          aria-controls={id}
          aria-label="Más información"
          title="Más información"
          className={`grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-full transition-colors hover:bg-surface-soft hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${abierta ? "text-foreground" : "text-muted"}`}
        >
          <svg
            aria-hidden="true"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          >
            <circle cx="10" cy="10" r="7.5" />
            <path d="M10 9v5M10 6h.01" />
          </svg>
        </button>
        {accion ? <div className="ml-auto shrink-0">{accion}</div> : null}
      </div>
      <div
        id={id}
        hidden={!abierta}
        className="mt-1 space-y-1 rounded-lg bg-surface-soft px-3 py-2 text-xs text-muted motion-safe:animate-aparecer"
      >
        {info}
      </div>
    </div>
  );
}
