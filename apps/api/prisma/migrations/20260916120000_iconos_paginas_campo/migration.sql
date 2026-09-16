-- Asigna íconos personalizados a las páginas de Gestión de campo y Mi jornada
UPDATE paginas
SET icono = 'clientes'
FROM modulos m
WHERE paginas.modulo_id = m.id AND m.ruta = 'gestion-campo' AND paginas.ruta = 'clientes';

UPDATE paginas
SET icono = 'locales'
FROM modulos m
WHERE paginas.modulo_id = m.id AND m.ruta = 'gestion-campo' AND paginas.ruta = 'locales';

UPDATE paginas
SET icono = 'tareas'
FROM modulos m
WHERE paginas.modulo_id = m.id AND m.ruta = 'gestion-campo' AND paginas.ruta = 'tareas';

UPDATE paginas
SET icono = 'equipo'
FROM modulos m
WHERE paginas.modulo_id = m.id AND m.ruta = 'gestion-campo' AND paginas.ruta = 'visitas';

UPDATE paginas
SET icono = 'ruta'
FROM modulos m
WHERE paginas.modulo_id = m.id AND m.ruta = 'mi-jornada' AND paginas.ruta = 'locales';

UPDATE paginas
SET icono = 'visitas'
FROM modulos m
WHERE paginas.modulo_id = m.id AND m.ruta = 'mi-jornada' AND paginas.ruta = 'tareas';
