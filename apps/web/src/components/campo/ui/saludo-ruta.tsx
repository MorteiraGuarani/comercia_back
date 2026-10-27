import type { ReactNode } from "react";

interface SaludoRutaProps {
  nombre: string;
  /** Día o rango consultado, a la izquierda debajo del saludo. */
  fechaTexto: string;
  resumen: string;
  /** Selector de período, debajo del saludo y a todo el ancho. */
  children: ReactNode;
}

export function SaludoRuta({
  nombre,
  fechaTexto,
  resumen,
  children,
}: SaludoRutaProps) {
  return (
    <section
      aria-label="Resumen del día"
      className="relative min-w-0 rounded-2xl border border-brand-100 bg-brand-50 px-3.5 py-3 dark:border-brand-900 dark:bg-brand-950/60 sm:px-5 sm:py-4"
    >
      {/* Recorrido decorativo; va aparte para no recortar el desplegable del período. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl"
      >
        <svg
          viewBox="0 0 220 100"
          preserveAspectRatio="xMaxYMid slice"
          fill="none"
          className="absolute inset-y-0 right-0 h-full w-[70%] max-w-md text-brand-600/25 dark:text-brand-200/15"
        >
          <path
            d="M70 108c18-22 40-24 62-30s38-22 56-46"
            stroke="currentColor"
            strokeWidth="14"
            strokeLinecap="round"
            opacity=".35"
          />
          <path
            d="M20 96c30-16 52-6 78-22s34-36 58-44 38-6 52-18"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeDasharray="2 7"
            strokeLinecap="round"
          />
          <circle cx="98" cy="74" r="4.5" fill="currentColor" />
          <path
            d="M156 6c-6.6 0-11 4.6-11 10.4 0 7.4 11 17.6 11 17.6s11-10.2 11-17.6C167 10.6 162.6 6 156 6z"
            className="fill-brand-600/60 dark:fill-brand-200/40"
          />
          <circle cx="156" cy="16.5" r="3.6" className="fill-brand-50 dark:fill-brand-950" />
        </svg>
      </div>

      <div className="relative min-w-0">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-200 sm:text-[11px]">
            {fechaTexto}
          </p>
          <h1 className="mt-0.5 truncate text-lg font-bold leading-tight text-foreground sm:text-2xl">
            {nombre ? `¡Hola, ${nombre}!` : "¡Hola!"}
          </h1>
          <p className="mt-0.5 text-xs text-muted sm:text-sm">{resumen}</p>
        </div>
        <div className="mt-2.5 min-w-0">{children}</div>
      </div>
    </section>
  );
}
