-- Itinerario del supervisor: su propia ruta, heredada de los locales de su
-- cadena dentro del equipo. Se asigna desde Administración (Accesos) igual
-- que las demás páginas de Gestión de campo.
INSERT INTO paginas(modulo_id, nombre, ruta, orden, activo, updated_at, icono)
SELECT m.id, 'Itinerario', 'itinerario',
  COALESCE((SELECT max(p.orden) FROM paginas p WHERE p.modulo_id = m.id), 0) + 1,
  true, CURRENT_TIMESTAMP, 'ruta'
FROM modulos m
WHERE m.ruta = 'gestion-campo'
ON CONFLICT (modulo_id, ruta) DO NOTHING;

-- Jefatura: el jefe ve el avance de todo su organigrama. Ninguna empresa lo
-- recibe sola: se habilita en Accesos para los roles de jefe.
INSERT INTO modulos(nombre, ruta, icono, orden, activo, updated_at)
VALUES ('Jefatura', 'jefatura', 'reportes', 5, true, CURRENT_TIMESTAMP)
ON CONFLICT (ruta) DO NOTHING;

INSERT INTO paginas(modulo_id, nombre, ruta, orden, activo, updated_at, icono)
SELECT m.id, 'Avance', 'avance', 1, true, CURRENT_TIMESTAMP, 'reportes'
FROM modulos m
WHERE m.ruta = 'jefatura'
ON CONFLICT (modulo_id, ruta) DO NOTHING;
