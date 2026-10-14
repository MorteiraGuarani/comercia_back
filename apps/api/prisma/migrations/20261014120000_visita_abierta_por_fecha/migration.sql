-- Las jornadas vencidas conservan salida NULL y se evalúan como incompletas.
-- Solo una visita sin salida por usuario y día; las anteriores no bloquean hoy.
BEGIN;
DROP INDEX campo_visita_abierta_usuario;
CREATE UNIQUE INDEX campo_visita_abierta_usuario_fecha
  ON campo_visitas(usuario_id, fecha) WHERE salida IS NULL;
COMMIT;
