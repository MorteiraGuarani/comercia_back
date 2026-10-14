"use client";

import { IconoEliminar } from "./ui/iconos-campo";

interface Props {
  etiqueta: string;
  onClick: () => void;
  modo?: "icono" | "texto";
  disabled?: boolean;
}

export function BotonEliminarCampo({ etiqueta, onClick, modo = "icono", disabled }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={etiqueta}
      title={etiqueta}
      className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 text-xs font-semibold text-[var(--campo-critico)] transition-colors hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--campo-critico)] disabled:cursor-not-allowed disabled:opacity-50 dark:text-[var(--campo-critico)] dark:hover:bg-surface-soft dark:focus-visible:ring-[var(--campo-critico)]"
    >
      <IconoEliminar className="h-4 w-4" />
      {modo === "texto" && "Eliminar"}
    </button>
  );
}
