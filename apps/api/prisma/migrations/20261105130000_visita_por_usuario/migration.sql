-- Una visita por persona en cada asignación/franja/día. Antes era una sola por
-- asignación: si el titular ya había visitado el local, la entrada de su
-- supervisor (que lo hereda por la cadena) quedaba guardada en Ucheck pero su
-- copia nunca llegaba a Comercia. Solo cambia índices: no toca filas.
-- Idempotente: se aplicó a mano en producción el 2026-11-05 para destrabar
-- una marca; el despliegue la vuelve a correr sin error.
DROP INDEX IF EXISTS "campo_visitas_asignacion_id_horario_id_fecha_key";
CREATE UNIQUE INDEX IF NOT EXISTS "campo_visitas_asignacion_id_horario_id_fecha_usuario_id_key"
  ON "campo_visitas"("asignacion_id", "horario_id", "fecha", "usuario_id");

DROP INDEX IF EXISTS campo_visita_sin_horario;
CREATE UNIQUE INDEX campo_visita_sin_horario
  ON campo_visitas(asignacion_id, fecha, usuario_id) WHERE horario_id IS NULL;
