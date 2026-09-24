import { IconoEditar } from "@/components/campo/ui/iconos-campo";

interface BotonEditarProps {
  onClick: () => void;
  etiqueta: string;
  modo?: "icono" | "texto";
  className?: string;
  disabled?: boolean;
}

export function BotonEditar({
  onClick,
  etiqueta,
  modo = "icono",
  className = "",
  disabled = false,
}: BotonEditarProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={etiqueta}
      title={etiqueta}
      disabled={disabled}
      className={`${
        modo === "icono"
          ? "inline-grid h-11 w-11 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-surface-soft hover:text-foreground md:h-9 md:w-9"
          : "inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-lg border border-line bg-surface-raised px-3 text-sm font-semibold text-foreground transition-colors hover:bg-surface-soft"
      } cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {modo === "icono" ? <IconoEditar className="h-4 w-4" /> : "Editar"}
    </button>
  );
}
