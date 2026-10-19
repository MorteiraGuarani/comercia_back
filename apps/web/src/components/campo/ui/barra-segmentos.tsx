interface Segmento {
  valor: number;
  /** Clase de color (con su variante dark:). */
  clase: string;
  etiqueta: string;
}

/** Barra horizontal apilada; el resto hasta el total queda en gris. */
export function BarraSegmentos({
  segmentos,
  total,
  alto = "h-2",
}: {
  segmentos: Segmento[];
  total: number;
  alto?: string;
}) {
  const visibles = segmentos.filter((s) => s.valor > 0);
  const descripcion = visibles.length
    ? visibles.map((s) => `${s.valor} ${s.etiqueta}`).join(", ")
    : "Sin datos";
  return (
    <span
      role="img"
      aria-label={descripcion}
      className={`flex w-full gap-0.5 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-700 ${alto}`}
    >
      {total > 0
        ? visibles.map((s) => (
            <i
              key={s.etiqueta}
              className={`block h-full ${s.clase}`}
              style={{ width: `${(s.valor / total) * 100}%` }}
            />
          ))
        : null}
    </span>
  );
}

/** Rayado de "en curso" para diferenciarlo de lo terminado. */
export const RAYADO_EN_CURSO =
  "bg-[repeating-linear-gradient(45deg,#0ea5e9_0_3px,#bae6fd_3px_6px)] dark:bg-[repeating-linear-gradient(45deg,#38bdf8_0_3px,#0c4a6e_3px_6px)]";
