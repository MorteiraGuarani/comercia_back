-- Administración de empresa: el ABM de usuarios y el organigrama de la
-- empresa, para roles como back office. Se prenden y apagan en Acceso por
-- empresa como cualquier módulo. Va después de Mi jornada en el menú.
-- ("Administración" a secas ya es el nombre de Locales en Gestión de campo.)
INSERT INTO modulos(nombre, ruta, icono, orden, activo, updated_at)
VALUES ('Administración de empresa', 'administracion', 'equipo', 30, true, CURRENT_TIMESTAMP)
ON CONFLICT (ruta) DO NOTHING;

INSERT INTO paginas(modulo_id, nombre, ruta, orden, activo, updated_at, icono)
SELECT m.id, p.nombre, p.ruta, p.orden, true, CURRENT_TIMESTAMP, p.icono
FROM modulos m
CROSS JOIN (VALUES
  ('Usuarios', 'usuarios', 1, 'clientes'),
  ('Organigrama', 'organigrama', 2, 'equipo')
) AS p(nombre, ruta, orden, icono)
WHERE m.ruta = 'administracion'
ON CONFLICT (modulo_id, ruta) DO NOTHING;

-- Lo reciben los roles de back office de cada empresa, con las dos páginas
-- por separado para poder apagar una sola. Una empresa sin back office no
-- recibe nada: se habilita en Acceso por empresa.
WITH backoffice AS (
  SELECT empresa_id, array_agg(id ORDER BY id) AS rol_ids
  FROM roles
  WHERE regexp_replace(lower(descripcion), '[^a-z]', '', 'g') LIKE 'backoffice%'
  GROUP BY empresa_id
)
INSERT INTO empresa_modulos(empresa_id, modulo_id, todas_las_paginas, rol_ids, created_at)
SELECT b.empresa_id, m.id, false, b.rol_ids, CURRENT_TIMESTAMP
FROM backoffice b
CROSS JOIN modulos m
WHERE m.ruta = 'administracion'
ON CONFLICT (empresa_id, modulo_id) DO NOTHING;

WITH backoffice AS (
  SELECT empresa_id, array_agg(id ORDER BY id) AS rol_ids
  FROM roles
  WHERE regexp_replace(lower(descripcion), '[^a-z]', '', 'g') LIKE 'backoffice%'
  GROUP BY empresa_id
)
INSERT INTO empresa_paginas(empresa_id, pagina_id, rol_ids, created_at)
SELECT b.empresa_id, p.id, b.rol_ids, CURRENT_TIMESTAMP
FROM backoffice b
JOIN paginas p ON p.ruta IN ('usuarios', 'organigrama')
JOIN modulos m ON m.id = p.modulo_id AND m.ruta = 'administracion'
ON CONFLICT (empresa_id, pagina_id) DO NOTHING;
