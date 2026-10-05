BEGIN;
CREATE TYPE "AccionTareaCampo" AS ENUM ('CONSULTAR','CREAR','EDITAR','ARCHIVAR');
ALTER TABLE roles ADD COLUMN permisos_tareas "AccionTareaCampo"[] NOT NULL DEFAULT ARRAY[]::"AccionTareaCampo"[];
ALTER TABLE roles ADD COLUMN puede_ver_seguimiento BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE roles SET permisos_tareas = ARRAY['CONSULTAR','CREAR','EDITAR','ARCHIVAR']::"AccionTareaCampo"[]
WHERE regexp_replace(lower(descripcion),'[^a-z]','','g') IN ('supervisor','supervisorrepositores');
UPDATE roles SET puede_ver_seguimiento=TRUE WHERE cardinality(permisos_tareas)>1;
UPDATE roles SET permisos_tareas = ARRAY['CONSULTAR']::"AccionTareaCampo"[]
WHERE regexp_replace(lower(descripcion),'[^a-z]','','g') IN ('teamleader','teamleaderimpulsador');
ALTER TABLE campo_tareas ADD COLUMN archivada_en TIMESTAMP(3), ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
CREATE TABLE campo_tarea_versiones (
 id SERIAL PRIMARY KEY, tarea_id INTEGER NOT NULL REFERENCES campo_tareas(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 version INTEGER NOT NULL, contenido JSONB NOT NULL, autor_id INTEGER, creada_en TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT campo_tarea_versiones_tarea_id_version_key UNIQUE(tarea_id,version)
);
INSERT INTO campo_tarea_versiones(tarea_id,version,contenido)
SELECT t.id,1,to_jsonb(t) || jsonb_build_object('localIds',COALESCE((SELECT jsonb_agg(tl.local_id ORDER BY tl.local_id) FROM campo_tarea_locales tl WHERE tl.tarea_id=t.id),'[]'::jsonb))
FROM campo_tareas t;
ALTER TABLE campo_cumplimientos ADD COLUMN version_tarea INTEGER NOT NULL DEFAULT 1,
 ADD COLUMN detalle_tarea JSONB, ADD COLUMN actividad_en TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 ADD COLUMN iniciada_at TIMESTAMP(3);
UPDATE campo_cumplimientos c SET detalle_tarea=v.contenido, actividad_en=COALESCE(c.completada_at,CURRENT_TIMESTAMP)
FROM campo_tarea_versiones v WHERE v.tarea_id=c.tarea_id AND v.version=1;
ALTER TABLE campo_tarea_comentarios ADD COLUMN operacion_id VARCHAR(36);
CREATE UNIQUE INDEX campo_tarea_comentarios_operacion_id_key ON campo_tarea_comentarios(operacion_id);
ALTER TABLE campo_tarea_fotos ADD COLUMN operacion_id VARCHAR(36);
CREATE UNIQUE INDEX campo_tarea_fotos_operacion_id_key ON campo_tarea_fotos(operacion_id);
COMMIT;
