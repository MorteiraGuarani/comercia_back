// Clases compartidas de la interfaz (una sola fuente para inputs y botones)

export const inputBase =
  "min-h-12 w-full rounded-xl border border-control-line bg-surface-raised px-3.5 py-2.5 text-[15px] text-foreground outline-none transition placeholder:text-muted hover:border-brand-500 focus:border-brand-600 focus:ring-2 focus:ring-focus";

export const labelBase =
  "flex flex-col gap-2 text-[13px] font-semibold text-foreground";

export const btnPrimary =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-brand-800 bg-brand-700 px-4 py-2.5 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-brand-800 focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2 focus:ring-offset-surface active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0";

export const btnGhost =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-control-line bg-surface-raised px-4 py-2 text-sm font-semibold text-foreground transition hover:border-brand-500 hover:bg-surface-soft focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2 focus:ring-offset-surface cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-control-line disabled:hover:bg-surface-raised";

/**
 * Rojo claro de toda acción que finaliza, termina o completa algo (Finalizar
 * Visita, Finalizar tarea, Cerrar novedad…). `colorFinalizar` para botones de
 * otro tamaño; `btnFinalizar` es el botón completo.
 */
export const colorFinalizar =
  "border border-red-300 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950/70";

export const btnFinalizar = `inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50 ${colorFinalizar}`;

export const errorBox =
  "rounded-xl border border-red-300 bg-red-50 px-3.5 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-100";

export const btnDanger =
  "inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-xl border border-red-800 bg-red-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-600/50 focus:ring-offset-2 focus:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-500 dark:bg-red-600 dark:text-white dark:hover:bg-red-500";
