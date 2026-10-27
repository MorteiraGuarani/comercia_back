-- Recuperar los avisos que solo recibieron los responsables y/o el jefe directo.
-- UNION corta ciclos y NOT EXISTS conserva las lecturas y evita duplicados.
WITH RECURSIVE eventos AS (
  SELECT DISTINCT ON (empresa_id, tipo, referencia_id, usuario_emisor_id)
    id, empresa_id, tipo, referencia_id, usuario_emisor_id, titulo, mensaje
  FROM campo_notificaciones
  WHERE tipo IN ('VENCIMIENTO_PROXIMO', 'COMENTARIO_TAREA', 'FOTO_SUBIDA', 'NOVEDAD_CREADA')
    AND referencia_id IS NOT NULL
  ORDER BY empresa_id, tipo, referencia_id, usuario_emisor_id, id DESC
), raices AS (
  SELECT e.id evento_id, e.empresa_id, u.id, u.superior_id, u.is_active
  FROM eventos e JOIN usuarios u ON u.id = e.usuario_emisor_id AND u.empresa_id = e.empresa_id
  UNION
  SELECT e.id, e.empresa_id, u.id, u.superior_id, u.is_active
  FROM eventos e
  JOIN campo_notificaciones n ON n.empresa_id = e.empresa_id AND n.tipo = e.tipo
    AND n.referencia_id = e.referencia_id AND n.usuario_emisor_id = e.usuario_emisor_id
  JOIN usuarios u ON u.id = n.usuario_destinatario_id AND u.empresa_id = e.empresa_id
  WHERE e.tipo = 'VENCIMIENTO_PROXIMO'
), cadena AS (
  SELECT * FROM raices
  UNION
  SELECT c.evento_id, c.empresa_id, u.id, u.superior_id, u.is_active
  FROM cadena c JOIN usuarios u ON u.id = c.superior_id AND u.empresa_id = c.empresa_id
)
INSERT INTO campo_notificaciones
  (empresa_id, usuario_destinatario_id, usuario_emisor_id, tipo, referencia_id, titulo, mensaje)
SELECT e.empresa_id, c.id, e.usuario_emisor_id, e.tipo, e.referencia_id, e.titulo, e.mensaje
FROM cadena c JOIN eventos e ON e.id = c.evento_id
WHERE c.is_active AND c.id <> e.usuario_emisor_id
  AND NOT EXISTS (
    SELECT 1 FROM campo_notificaciones n
    WHERE n.empresa_id = e.empresa_id AND n.usuario_destinatario_id = c.id
      AND n.usuario_emisor_id = e.usuario_emisor_id AND n.tipo = e.tipo
      AND n.referencia_id = e.referencia_id
  );

-- Una marca sin avisos (por una interrupción del proceso anterior) se reintenta.
UPDATE campo_inventario_cargas c SET avisado_en = NULL
WHERE c.avisado_en IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM campo_notificaciones n
  WHERE n.empresa_id = c.empresa_id AND n.tipo = 'VENCIMIENTO_PROXIMO' AND n.referencia_id = c.id
);
