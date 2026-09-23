-- Supervisor y TeamLeader comparten las pantallas de gestión de campo.
-- Se conserva la configuración de cada empresa y no se reasignan usuarios.
INSERT INTO roles (empresa_id, descripcion, roles_id)
SELECT tl.empresa_id, 'SUPERVISOR', NULL
FROM roles tl
WHERE regexp_replace(lower(tl.descripcion), '[^a-z]', '', 'g') = 'teamleader'
ON CONFLICT (empresa_id, descripcion) DO NOTHING;

UPDATE roles tl
SET roles_id = sup.id
FROM roles sup
WHERE tl.empresa_id = sup.empresa_id
  AND regexp_replace(lower(tl.descripcion), '[^a-z]', '', 'g') = 'teamleader'
  AND upper(sup.descripcion) = 'SUPERVISOR'
  AND tl.id <> sup.id;

UPDATE empresa_modulos em
SET rol_ids = ARRAY(
  SELECT DISTINCT id FROM unnest(em.rol_ids || ARRAY[sup.id]) AS id
  ORDER BY id
)
FROM modulos m, roles sup
WHERE em.modulo_id = m.id AND m.ruta = 'gestion-campo'
  AND sup.empresa_id = em.empresa_id AND upper(sup.descripcion) = 'SUPERVISOR'
  AND EXISTS (
    SELECT 1 FROM roles tl
    WHERE tl.empresa_id = em.empresa_id
      AND regexp_replace(lower(tl.descripcion), '[^a-z]', '', 'g') = 'teamleader'
      AND (cardinality(em.rol_ids) = 0 OR tl.id = ANY(em.rol_ids))
  )
  AND cardinality(em.rol_ids) > 0;

UPDATE empresa_paginas ep
SET rol_ids = ARRAY(
  SELECT DISTINCT id FROM unnest(ep.rol_ids || ARRAY[sup.id]) AS id
  ORDER BY id
)
FROM paginas p, modulos m, roles sup
WHERE ep.pagina_id = p.id AND p.modulo_id = m.id AND m.ruta = 'gestion-campo'
  AND sup.empresa_id = ep.empresa_id AND upper(sup.descripcion) = 'SUPERVISOR'
  AND cardinality(ep.rol_ids) > 0
  AND EXISTS (
    SELECT 1 FROM roles tl
    WHERE tl.empresa_id = ep.empresa_id
      AND regexp_replace(lower(tl.descripcion), '[^a-z]', '', 'g') = 'teamleader'
      AND tl.id = ANY(ep.rol_ids)
  );
