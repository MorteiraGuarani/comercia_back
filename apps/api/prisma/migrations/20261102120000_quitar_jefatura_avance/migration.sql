-- Jefatura · Avance se quita: Desempeño muestra lo mismo, con los filtros de
-- equipo y responsable y la cascada del organigrama (gerente › jefe › …).
-- Antes de borrarla, quien veía Avance pasa a ver Desempeño. Un rol_ids vacío
-- significa "todos los roles", así que la unión con uno vacío queda vacía.
INSERT INTO empresa_paginas(empresa_id, pagina_id, rol_ids, created_at)
SELECT ep.empresa_id, d.id, ep.rol_ids, CURRENT_TIMESTAMP
FROM empresa_paginas ep
JOIN paginas a ON a.id = ep.pagina_id AND a.ruta = 'avance'
JOIN modulos m ON m.id = a.modulo_id AND m.ruta = 'jefatura'
JOIN paginas d ON d.modulo_id = m.id AND d.ruta = 'desempeno'
ON CONFLICT (empresa_id, pagina_id) DO UPDATE
SET rol_ids = CASE
  WHEN cardinality(empresa_paginas.rol_ids) = 0 OR cardinality(EXCLUDED.rol_ids) = 0
    THEN '{}'::int[]
  ELSE ARRAY(
    SELECT DISTINCT r FROM unnest(empresa_paginas.rol_ids || EXCLUDED.rol_ids) AS r ORDER BY r
  )
END;

-- Borra la página; sus asignaciones por empresa y ejecutables caen en cascada.
DELETE FROM paginas p
USING modulos m
WHERE p.modulo_id = m.id AND m.ruta = 'jefatura' AND p.ruta = 'avance';

-- Desempeño queda como la primera (y única) página de Jefatura.
UPDATE paginas p
SET orden = 1, updated_at = CURRENT_TIMESTAMP
FROM modulos m
WHERE p.modulo_id = m.id AND m.ruta = 'jefatura' AND p.ruta = 'desempeno';
