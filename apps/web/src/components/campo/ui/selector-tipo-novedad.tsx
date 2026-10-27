import type { TipoNovedad } from "@/types/campo";
import { IconoAlerta, IconoIdea, IconoMegafono, IconoPregunta } from "./iconos-campo";

const TIPOS: { valor: TipoNovedad; etiqueta: string; Icono: typeof IconoAlerta }[] = [
  { valor: "INCIDENCIA", etiqueta: "Incidencia", Icono: IconoAlerta },
  { valor: "RECLAMO", etiqueta: "Reclamo", Icono: IconoMegafono },
  { valor: "CONSULTA", etiqueta: "Consulta", Icono: IconoPregunta },
  { valor: "SUGERENCIA", etiqueta: "Sugerencia", Icono: IconoIdea },
];

/** Tipo de novedad: los cuatro en una fila, con el ícono arriba para que entren en el celular. */
export function SelectorTipoNovedad({
  valor,
  onCambiar,
}: {
  valor: TipoNovedad;
  onCambiar: (tipo: TipoNovedad) => void;
}) {
  return (
    <div role="group" aria-label="Tipo de novedad" className="grid min-w-0 grid-cols-4 gap-1.5">
      {TIPOS.map((t) => (
        <button
          key={t.valor}
          type="button"
          aria-pressed={valor === t.valor}
          onClick={() => onCambiar(t.valor)}
          className={`flex min-h-14 min-w-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border px-1 py-1.5 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50 sm:text-xs ${
            valor === t.valor
              ? "border-foreground bg-foreground text-background"
              : "border-line bg-surface-raised text-foreground hover:bg-surface-soft"
          }`}
        >
          <t.Icono className="h-4 w-4 shrink-0" />
          <span className="max-w-full truncate">{t.etiqueta}</span>
        </button>
      ))}
    </div>
  );
}
