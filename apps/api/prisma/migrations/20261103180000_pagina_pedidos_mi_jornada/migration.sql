-- Página Pedidos de Mi jornada, propia y separada de Inventario. Se asigna desde
-- Administración igual que las demás páginas del módulo.
INSERT INTO paginas(modulo_id, nombre, ruta, orden, activo, updated_at, icono)
SELECT m.id, 'Pedidos', 'pedidos',
  COALESCE((SELECT max(p.orden) FROM paginas p WHERE p.modulo_id = m.id), 0) + 1,
  true, CURRENT_TIMESTAMP, 'pedidos'
FROM modulos m
WHERE m.ruta = 'mi-jornada'
ON CONFLICT (modulo_id, ruta) DO NOTHING;
