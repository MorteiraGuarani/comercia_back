"use client";

import { createPortal } from "react-dom";
import { useDestinoPortal } from "@/hooks/use-destino-portal";

export function PantallaCarga({
  visible,
  mensaje,
  detalle,
}: {
  visible: boolean;
  mensaje: string;
  detalle?: string;
}) {
  const destinoPortal = useDestinoPortal();
  if (!visible || !destinoPortal) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[5000] grid place-items-center bg-[#0d1f19]/85 p-4"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-busy="true"
    >
      <div className="w-full max-w-sm rounded-[1.4rem] border border-control-line bg-surface-raised p-5 text-foreground shadow-[0_28px_80px_rgba(0,0,0,0.38)]">
        <div className="flex items-center gap-3">
          <span
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-200"
            aria-hidden
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="h-6 w-6"
            >
              <path d="M3.5 6.5h10v10h-10z" />
              <path d="M13.5 10h3.2l3.8 3.8v2.7h-7z" />
              <circle cx="7" cy="18" r="1.7" />
              <circle cx="17.5" cy="18" r="1.7" />
            </svg>
          </span>
          <div className="min-w-0">
            <p className="font-semibold">{mensaje}</p>
            <p className="mt-0.5 text-sm text-muted">
              {detalle ?? "Esperá un momento, estamos procesando la operación."}
            </p>
          </div>
        </div>

        <div
          className="mt-5 h-1.5 overflow-hidden rounded-full bg-surface-soft"
          role="progressbar"
          aria-label={mensaje}
        >
          <div className="pantalla-carga-indeterminada h-full w-2/5 rounded-full bg-gradient-to-r from-brand-500 via-brand-700 to-accent" />
        </div>
      </div>
    </div>,
    destinoPortal,
  );
}
