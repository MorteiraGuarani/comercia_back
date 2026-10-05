BEGIN;
ALTER TABLE usuarios ADD COLUMN permitir_vinculo_automatico BOOLEAN NOT NULL DEFAULT TRUE;
CREATE TABLE campo_operaciones (
 id VARCHAR(80) PRIMARY KEY,usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 ucheck_jornada_id INTEGER NOT NULL,tipo "TipoEventoUcheck" NOT NULL,estado VARCHAR(16) NOT NULL DEFAULT 'PENDIENTE',
 nota VARCHAR(250) NOT NULL DEFAULT '',creada_en TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,actualizada_en TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX campo_operaciones_usuario_id_estado_idx ON campo_operaciones(usuario_id,estado);
CREATE TABLE campo_seguimiento (
 usuario_id INTEGER PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE ON UPDATE CASCADE,
 jornada_id VARCHAR(36) NOT NULL, activo BOOLEAN NOT NULL DEFAULT FALSE,
 iniciada_en TIMESTAMP(3) NOT NULL, reportada_en TIMESTAMP(3) NOT NULL,
 recibida_en TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 latitud DOUBLE PRECISION, longitud DOUBLE PRECISION, precision_metros DOUBLE PRECISION, capturada_en TIMESTAMP(3)
);
CREATE INDEX campo_seguimiento_activo_recibida_en_idx ON campo_seguimiento(activo,recibida_en);
INSERT INTO paginas(modulo_id,nombre,ruta,icono,orden,activo,created_at,updated_at)
SELECT id,'Seguimiento en vivo','seguimiento','map-outline',90,TRUE,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP FROM modulos WHERE ruta='gestion-campo'
ON CONFLICT(modulo_id,ruta) DO NOTHING;
INSERT INTO empresa_paginas(empresa_id,pagina_id,rol_ids,created_at)
SELECT r.empresa_id,p.id,array_agg(r.id ORDER BY r.id),CURRENT_TIMESTAMP
FROM roles r JOIN paginas p ON p.ruta='seguimiento' JOIN modulos m ON m.id=p.modulo_id AND m.ruta='gestion-campo'
WHERE r.puede_ver_seguimiento
GROUP BY r.empresa_id,p.id
ON CONFLICT(empresa_id,pagina_id) DO UPDATE SET rol_ids=EXCLUDED.rol_ids;
COMMIT;
