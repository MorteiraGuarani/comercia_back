-- Jefatura · Desempeño: el avance del organigrama del jefe en cascada
-- (supervisores, TeamLeaders y su personal). Lo reciben los mismos roles que
-- ya tienen Avance; el resto se habilita en Accesos.
INSERT INTO paginas(modulo_id, nombre, ruta, orden, activo, updated_at, icono)
SELECT m.id, 'Desempeño', 'desempeno', 2, true, CURRENT_TIMESTAMP, 'reportes'
FROM modulos m
WHERE m.ruta = 'jefatura'
ON CONFLICT (modulo_id, ruta) DO NOTHING;

INSERT INTO empresa_paginas(empresa_id, pagina_id, rol_ids, created_at)
SELECT ep.empresa_id, nueva.id, ep.rol_ids, CURRENT_TIMESTAMP
FROM empresa_paginas ep
JOIN paginas avance ON avance.id = ep.pagina_id AND avance.ruta = 'avance'
JOIN modulos m ON m.id = avance.modulo_id AND m.ruta = 'jefatura'
JOIN paginas nueva ON nueva.modulo_id = m.id AND nueva.ruta = 'desempeno'
ON CONFLICT (empresa_id, pagina_id) DO NOTHING;
