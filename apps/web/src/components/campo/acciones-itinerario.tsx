import { IconoCalendario, IconoEquipo } from "./ui/iconos-campo";

export function AccionesItinerario({
  nombre,
  onInformacion,
  onItinerario,
  onAsignacion,
}: {
  nombre: string;
  onInformacion: () => void;
  onItinerario: () => void;
  onAsignacion: () => void;
}) {
  const clase =
    "grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-lg border border-line bg-surface-raised text-foreground transition-colors hover:border-brand-500 hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus";
  return (
    <div
      className="flex items-center gap-1.5"
      aria-label={`Acciones de ${nombre}`}
    >
      <button
        type="button"
        onClick={onInformacion}
        aria-label={`Información de ${nombre}`}
        title="Información"
        className={clase}
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
      <button
        type="button"
        onClick={onItinerario}
        aria-label={`Itinerario de ${nombre}`}
        title="Itinerario"
        className={clase}
      >
        <IconoCalendario className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={onAsignacion}
        aria-label={`Asignación de ${nombre}`}
        title="Asignación"
        className={clase}
      >
        <IconoEquipo className="h-5 w-5" />
      </button>
    </div>
  );
}
