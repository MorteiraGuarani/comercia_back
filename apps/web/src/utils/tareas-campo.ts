import type { TareaJornadaCampo } from "@/types/campo";

export function tareaCumplidaEnVisita(
  tarea: Pick<TareaJornadaCampo, "visitasCompletadas">,
  visitaId?: number,
): boolean {
  return visitaId === undefined
    ? tarea.visitasCompletadas.length > 0
    : tarea.visitasCompletadas.includes(visitaId);
}
