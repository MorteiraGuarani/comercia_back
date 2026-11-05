-- Varias visitas abiertas a la vez en distintos locales: el usuario puede
-- entrar a otro local sin cerrar el anterior y volver a cerrarlo después.
-- La que no cierra queda incompleta. Sigue el índice (usuario_id, fecha).
DROP INDEX IF EXISTS campo_visita_abierta_usuario_fecha;
