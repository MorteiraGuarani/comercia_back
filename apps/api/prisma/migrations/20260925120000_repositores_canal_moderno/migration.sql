CREATE TYPE "DestinatarioTareaCampo" AS ENUM ('IMPULSADOR', 'REPOSITOR', 'AMBOS');
ALTER TABLE campo_tareas ADD COLUMN destinatario "DestinatarioTareaCampo" NOT NULL DEFAULT 'IMPULSADOR';
ALTER TABLE campo_horarios ADD COLUMN asignacion_id INTEGER;
ALTER TABLE campo_horarios ADD CONSTRAINT campo_horarios_asignacion_id_fkey
  FOREIGN KEY (asignacion_id) REFERENCES campo_asignaciones(id) ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX campo_horarios_asignacion_id_activo_idx ON campo_horarios(asignacion_id, activo);

-- El supervisor de repositores administra colaboradores directos, sin TeamLeader.
INSERT INTO roles (empresa_id, descripcion, roles_id)
SELECT e.id, 'SUPERVISOR_REPOSITORES', NULL FROM empresas e
ON CONFLICT (empresa_id, descripcion) DO NOTHING;
INSERT INTO roles (empresa_id, descripcion, roles_id)
SELECT e.id, 'REPOSITOR', s.id FROM empresas e
JOIN roles s ON s.empresa_id = e.id AND s.descripcion = 'SUPERVISOR_REPOSITORES'
ON CONFLICT (empresa_id, descripcion) DO NOTHING;
UPDATE roles r SET roles_id = s.id
FROM roles s WHERE r.empresa_id = s.empresa_id
  AND r.descripcion = 'REPOSITOR' AND s.descripcion = 'SUPERVISOR_REPOSITORES'
  AND r.roles_id IS DISTINCT FROM s.id;

UPDATE modulos SET nombre = 'Gestión de campo · Canal moderno'
WHERE ruta = 'gestion-campo';
UPDATE modulos SET nombre = 'Mi jornada · Canal moderno'
WHERE ruta = 'mi-jornada';

-- Se amplían únicamente permisos de campo ya configurados.
UPDATE empresa_modulos em SET rol_ids = ARRAY(
  SELECT DISTINCT id FROM unnest(em.rol_ids || ARRAY[r.id]) id ORDER BY id
) FROM modulos m, roles r
WHERE em.modulo_id = m.id AND em.empresa_id = r.empresa_id
  AND cardinality(em.rol_ids) > 0
  AND ((m.ruta = 'gestion-campo' AND r.descripcion = 'SUPERVISOR_REPOSITORES')
    OR (m.ruta = 'mi-jornada' AND r.descripcion = 'REPOSITOR'));
UPDATE empresa_paginas ep SET rol_ids = ARRAY(
  SELECT DISTINCT id FROM unnest(ep.rol_ids || ARRAY[r.id]) id ORDER BY id
) FROM paginas p, modulos m, roles r
WHERE ep.pagina_id = p.id AND p.modulo_id = m.id AND ep.empresa_id = r.empresa_id
  AND cardinality(ep.rol_ids) > 0
  AND ((m.ruta = 'gestion-campo' AND r.descripcion = 'SUPERVISOR_REPOSITORES')
    OR (m.ruta = 'mi-jornada' AND r.descripcion = 'REPOSITOR'));
