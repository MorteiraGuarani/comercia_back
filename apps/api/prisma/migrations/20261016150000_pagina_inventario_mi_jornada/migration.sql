-- Página Inventario de Mi jornada: artículos bulk de tbl_itm1 que el impulsador
-- elige y conserva en su navegador. Si la empresa habilita "todas las páginas"
-- del módulo, sus roles la ven de inmediato; si no, se asigna desde
-- Administración, igual que las demás páginas del módulo.
INSERT INTO paginas(modulo_id, nombre, ruta, orden, activo, updated_at, icono)
SELECT m.id, 'Inventario', 'inventario',
  COALESCE((SELECT max(p.orden) FROM paginas p WHERE p.modulo_id = m.id), 0) + 1,
  true, CURRENT_TIMESTAMP, 'inventario'
FROM modulos m
WHERE m.ruta = 'mi-jornada'
ON CONFLICT (modulo_id, ruta) DO NOTHING;
