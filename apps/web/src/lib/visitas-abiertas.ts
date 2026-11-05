import { apiFetch } from "@/lib/api";
import type { RespuestaPaginada } from "@/types/paginacion";
import type { VisitaCampo } from "@/types/campo";

/**
 * Visitas sin salida de hoy, la más reciente primero. Puede haber varias:
 * se entra a otro local sin cerrar el anterior.
 * shortcut: trae solo la primera página de 50; nadie abre tantas en un día.
 */
export function visitasAbiertas(init?: RequestInit): Promise<VisitaCampo[]> {
  return apiFetch<RespuestaPaginada<VisitaCampo>>(
    "/campo/jornada/abiertas?limit=50",
    init,
  ).then((r) => r.items);
}
