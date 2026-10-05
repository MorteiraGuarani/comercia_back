BEGIN;

-- Los locales siguen siendo únicos y compartidos. Solo se separa su planificación.
ALTER TABLE "campo_horarios" ADD COLUMN "destinatario" "DestinatarioTareaCampo" NOT NULL DEFAULT 'IMPULSADOR';

UPDATE campo_horarios h SET destinatario = 'REPOSITOR'
FROM campo_asignaciones a JOIN usuarios u ON u.id = a.usuario_id
JOIN roles r ON r.id = u.rol_id AND r.empresa_id = u.empresa_id
WHERE h.asignacion_id = a.id
  AND regexp_replace(lower(r.descripcion), '[^a-z]', '', 'g') = 'repositor';

-- Conserva los horarios generales previos de los locales usados por ambos equipos,
-- con franjas independientes a partir de esta migración. No modifica visitas/logs.
INSERT INTO campo_horarios (local_id, destinatario, frecuencia, intervalo, dias_semana,
  dias_mes, fecha_desde, fecha_hasta, entrada, salida, activo)
SELECT h.local_id, 'REPOSITOR', h.frecuencia, h.intervalo, h.dias_semana,
  h.dias_mes, h.fecha_desde, h.fecha_hasta, h.entrada, h.salida, h.activo
FROM campo_horarios h
WHERE h.asignacion_id IS NULL AND h.activo AND EXISTS (
  SELECT 1 FROM campo_asignaciones a JOIN usuarios u ON u.id = a.usuario_id
  JOIN roles r ON r.id = u.rol_id AND r.empresa_id = u.empresa_id
  WHERE a.local_id = h.local_id AND a.activo
    AND regexp_replace(lower(r.descripcion), '[^a-z]', '', 'g') = 'repositor'
);

CREATE INDEX "campo_horarios_local_id_destinatario_activo_idx"
  ON "campo_horarios" ("local_id", "destinatario", "activo");
ALTER TABLE "campo_horarios" ADD CONSTRAINT "campo_horarios_equipo_check" CHECK (destinatario <> 'AMBOS');

-- Una tarea antigua para AMBOS pasa a dos tareas independientes. Conserva los
-- locales, cumplimientos, fotos y comentarios del repositor sin compartir ediciones.
DO $$
DECLARE tarea RECORD; nueva_id INTEGER;
BEGIN
  FOR tarea IN SELECT * FROM campo_tareas WHERE destinatario = 'AMBOS' ORDER BY id LOOP
    INSERT INTO campo_tareas (empresa_id, nombre, destinatario, descripcion, todos_locales,
      fecha_desde, fecha_hasta, activo, requiere_fotos, fotos_obligatorias, categoria,
      estado, es_obligatoria)
    VALUES (tarea.empresa_id, tarea.nombre, 'REPOSITOR', tarea.descripcion, tarea.todos_locales,
      tarea.fecha_desde, tarea.fecha_hasta, tarea.activo, tarea.requiere_fotos,
      tarea.fotos_obligatorias, tarea.categoria, tarea.estado, tarea.es_obligatoria)
    RETURNING id INTO nueva_id;

    INSERT INTO campo_tarea_locales (tarea_id, local_id)
    SELECT nueva_id, local_id FROM campo_tarea_locales WHERE tarea_id = tarea.id;

    INSERT INTO campo_cumplimientos (visita_id, tarea_id, nombre_tarea, completada_at, fotos_validadas)
    SELECT c.visita_id, nueva_id, c.nombre_tarea, c.completada_at, c.fotos_validadas
    FROM campo_cumplimientos c JOIN campo_visitas v ON v.id = c.visita_id
    JOIN usuarios u ON u.id = v.usuario_id JOIN roles r ON r.id = u.rol_id AND r.empresa_id = u.empresa_id
    WHERE c.tarea_id = tarea.id AND regexp_replace(lower(r.descripcion), '[^a-z]', '', 'g') = 'repositor';

    UPDATE campo_tarea_comentarios e SET cumplimiento_tarea_id = nueva_id
    WHERE e.cumplimiento_tarea_id = tarea.id AND EXISTS (
      SELECT 1 FROM campo_cumplimientos c WHERE c.visita_id = e.cumplimiento_visita_id AND c.tarea_id = nueva_id
    );
    UPDATE campo_tarea_fotos e SET cumplimiento_tarea_id = nueva_id
    WHERE e.cumplimiento_tarea_id = tarea.id AND EXISTS (
      SELECT 1 FROM campo_cumplimientos c WHERE c.visita_id = e.cumplimiento_visita_id AND c.tarea_id = nueva_id
    );
    DELETE FROM campo_cumplimientos c WHERE c.tarea_id = tarea.id AND EXISTS (
      SELECT 1 FROM campo_cumplimientos nueva WHERE nueva.visita_id = c.visita_id AND nueva.tarea_id = nueva_id
    );
    UPDATE campo_novedades n SET tarea_id = nueva_id
    FROM usuarios u JOIN roles r ON r.id = u.rol_id AND r.empresa_id = u.empresa_id
    WHERE n.tarea_id = tarea.id AND n.usuario_id = u.id
      AND regexp_replace(lower(r.descripcion), '[^a-z]', '', 'g') = 'repositor';

    UPDATE campo_tareas SET destinatario = 'IMPULSADOR' WHERE id = tarea.id;
  END LOOP;
END $$;

ALTER TABLE "campo_tareas" ADD CONSTRAINT "campo_tareas_equipo_check" CHECK (destinatario <> 'AMBOS');
CREATE INDEX "campo_tareas_empresa_id_destinatario_activo_idx"
  ON "campo_tareas" ("empresa_id", "destinatario", "activo");

COMMIT;
