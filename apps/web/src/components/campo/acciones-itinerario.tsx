import { IconoCalendario, IconoEquipo } from "./ui/iconos-campo";

function IconoInfo({ className }: { className: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    >
      <circle cx="10" cy="10" r="7.5" />
      <path d="M10 9v5M10 6h.01" />
    </svg>
  );
}

/**
 * Info, Horarios (agenda) y Equipo (asignación) de un local. En la tabla van
 * como íconos; en la tarjeta del celular, como botones grandes con texto.
 */
export function AccionesItinerario({
  nombre,
  onInformacion,
  onItinerario,
  onAsignacion,
  variante = "iconos",
}: {
  nombre: string;
  onInformacion: () => void;
  onItinerario: () => void;
  onAsignacion: () => void;
  variante?: "iconos" | "tarjeta";
}) {
  const tarjeta = variante === "tarjeta";
  const clase = tarjeta
    ? "flex min-h-16 min-w-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-line bg-surface-raised px-1 text-xs font-semibold text-foreground transition-colors hover:border-brand-500 hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
    : "grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-lg border border-line bg-surface-raised text-foreground transition-colors hover:border-brand-500 hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus";
  // En la tarjeta, Horarios es la acción principal.
  const principal = tarjeta
    ? "flex min-h-16 min-w-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-brand-700 bg-brand-700 px-1 text-xs font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus dark:border-brand-500 dark:bg-brand-500 dark:text-brand-950 dark:hover:bg-brand-400"
    : clase;
  const icono = tarjeta ? "h-6 w-6" : "h-5 w-5";
  return (
    <div
      className={
        tarjeta ? "grid grid-cols-3 gap-2" : "flex items-center gap-1.5"
      }
      aria-label={`Acciones de ${nombre}`}
    >
      <button
        type="button"
        onClick={onInformacion}
        aria-label={`Información de ${nombre}`}
        title="Información"
        className={clase}
      >
        <IconoInfo className={icono} />
        {tarjeta ? "Info" : null}
      </button>
      <button
        type="button"
        onClick={onItinerario}
        aria-label={`Itinerario de ${nombre}`}
        title="Agenda del local"
        className={principal}
      >
        <IconoCalendario className={icono} />
        {tarjeta ? "Horarios" : null}
      </button>
      <button
        type="button"
        onClick={onAsignacion}
        aria-label={`Asignación de ${nombre}`}
        title="Equipo asignado"
        className={clase}
      >
        <IconoEquipo className={icono} />
        {tarjeta ? "Equipo" : null}
      </button>
    </div>
  );
}
