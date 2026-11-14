interface BotonCopiarProps {
  onClick: () => void;
  etiqueta: string;
  modo?: "icono" | "texto";
  className?: string;
  disabled?: boolean;
}

export function BotonCopiar({
  onClick,
  etiqueta,
  modo = "icono",
  className = "",
  disabled,
}: BotonCopiarProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={etiqueta}
      title={etiqueta}
      className={`${
        modo === "icono"
          ? "inline-grid h-11 w-11 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-surface-soft hover:text-foreground md:h-9 md:w-9"
          : "inline-flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-line bg-surface-raised px-3 text-sm font-semibold text-foreground transition-colors hover:bg-surface-soft"
      } cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
        aria-hidden
      >
        <rect x="9" y="9" width="12" height="12" rx="2" />
        <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
      </svg>
      {modo === "texto" ? "Copiar Pedido" : null}
    </button>
  );
}
