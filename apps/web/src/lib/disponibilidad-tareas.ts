import { apiFetch } from "./api";
import type { AgendaCampo, TareasDeAsignacion } from "@/types/campo";
import type { RespuestaPaginada } from "@/types/paginacion";

/** Revisa toda la ruta paginada y termina al encontrar una tarea, sin exigir entrada. */
export async function hayTareasAsignadas(consulta: string, signal: AbortSignal): Promise<boolean> {
  let page = 1;
  let totalPages = 1;
  do {
    const agenda = await apiFetch<RespuestaPaginada<AgendaCampo>>(
      `/campo/jornada?${consulta}&page=${page}&limit=50`, { signal },
    );
    totalPages = agenda.totalPages;
    if (agenda.items.length) {
      const tareas = await apiFetch<{ items: TareasDeAsignacion[] }>(
        `/campo/jornada/tareas?${consulta}&asignaciones=${agenda.items.map((a) => a.id).join(",")}&page=1&limit=1`,
        { signal },
      );
      if (tareas.items.some((t) => t.total > 0)) return true;
    }
    page += 1;
  } while (page <= totalPages);
  return false;
}
