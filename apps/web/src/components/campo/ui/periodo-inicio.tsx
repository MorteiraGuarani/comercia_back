"use client";

import { SelectorFechaFiltro } from "./selector-fecha-filtro";
import type { PeriodoFiltro } from "@/types/periodo-filtro";

/** El mismo calendario para todos los tableros de Inicio. */
export function SelectorPeriodoInicio({
  valor,
  onCambiar,
}: {
  valor: PeriodoFiltro;
  onCambiar: (periodo: PeriodoFiltro) => void;
}) {
  return (
    <SelectorFechaFiltro valorActual={valor} onChange={onCambiar} />
  );
}
