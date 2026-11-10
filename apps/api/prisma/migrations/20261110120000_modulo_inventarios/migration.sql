-- Inventarios cargados por el usuario y su equipo. Módulo propio: se activa por
-- empresa y rol en Acceso por empresa (nadie lo recibe solo) y se abre desde el
-- menú del perfil. No va en Gestión de campo porque ese módulo define el Inicio.
INSERT INTO modulos(nombre, ruta, icono, orden, activo, updated_at)
VALUES ('Inventarios', 'inventarios', 'inventario', 40, true, CURRENT_TIMESTAMP)
ON CONFLICT (ruta) DO NOTHING;

INSERT INTO paginas(modulo_id, nombre, ruta, orden, activo, updated_at, icono)
SELECT m.id, 'Inventarios', 'cargas', 1, true, CURRENT_TIMESTAMP, 'inventario'
FROM modulos m
WHERE m.ruta = 'inventarios'
ON CONFLICT (modulo_id, ruta) DO NOTHING;
