/**
 * Avance de tareas de la ruta de un colaborador: cada tarea cuenta una vez por
 * local donde aplica (2 tareas en 3 locales = 6) y queda hecha solo si se
 * finalizó en una visita a ese local.
 */
export function avanceTareasPorLocal(
  localIds: Iterable<string>,
  tareas: {
    id: number;
    esObligatoria: boolean;
    todosLocales: boolean;
    locales: { localId: string }[];
  }[],
  visitas: { localId: string; cumplimientos: { tareaId: number }[] }[],
) {
  let total = 0;
  let completadas = 0;
  let obligPendientes = 0;
  for (const localId of localIds) {
    const hechas = new Set(
      visitas
        .filter((v) => v.localId === localId)
        .flatMap((v) => v.cumplimientos.map((c) => c.tareaId)),
    );
    for (const t of tareas) {
      if (!t.todosLocales && !t.locales.some((l) => l.localId === localId))
        continue;
      total++;
      if (hechas.has(t.id)) completadas++;
      else if (t.esObligatoria) obligPendientes++;
    }
  }
  return { total, completadas, obligPendientes };
}
