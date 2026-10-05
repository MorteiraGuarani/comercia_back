BEGIN;

CREATE TABLE campo_equipos_operativos (
  id SERIAL PRIMARY KEY,
  empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  nombre VARCHAR(120) NOT NULL,
  tipo "DestinatarioTareaCampo" NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT campo_equipos_operativos_tipo_check CHECK (tipo <> 'AMBOS'),
  CONSTRAINT campo_equipos_operativos_empresa_id_nombre_key UNIQUE (empresa_id,nombre),
  CONSTRAINT campo_equipos_operativos_id_empresa_id_key UNIQUE (id,empresa_id)
);

INSERT INTO campo_equipos_operativos (empresa_id,nombre,tipo)
SELECT e.id, 'Impulsadores', 'IMPULSADOR' FROM empresas e;
INSERT INTO campo_equipos_operativos (empresa_id,nombre,tipo)
SELECT e.id, 'Repositores', 'REPOSITOR' FROM empresas e;

ALTER TABLE roles ADD COLUMN equipo_campo_id INTEGER;
UPDATE roles r SET equipo_campo_id = g.id
FROM campo_equipos_operativos g
WHERE g.empresa_id = r.empresa_id AND (
  (g.tipo = 'REPOSITOR' AND regexp_replace(lower(r.descripcion), '[^a-z]', '', 'g') IN ('repositor','supervisorrepositores'))
  OR (g.tipo = 'IMPULSADOR' AND regexp_replace(lower(r.descripcion), '[^a-z]', '', 'g') IN
    ('superadministrador','superadmin','supervisor','teamleader','teamleaderimpulsador','impulsador'))
);
-- Los nombres desconocidos quedan sin equipo: no heredan planificación ajena.
ALTER TABLE roles ADD CONSTRAINT roles_equipo_campo_id_empresa_id_fkey
  FOREIGN KEY (equipo_campo_id,empresa_id) REFERENCES campo_equipos_operativos(id,empresa_id);

ALTER TABLE campo_tareas ADD COLUMN equipo_campo_id INTEGER;
UPDATE campo_tareas t SET equipo_campo_id = g.id FROM campo_equipos_operativos g
WHERE g.empresa_id = t.empresa_id AND g.tipo = t.destinatario;
ALTER TABLE campo_tareas ALTER COLUMN equipo_campo_id SET NOT NULL;
ALTER TABLE campo_tareas ADD CONSTRAINT campo_tareas_equipo_campo_id_empresa_id_fkey
  FOREIGN KEY (equipo_campo_id,empresa_id) REFERENCES campo_equipos_operativos(id,empresa_id);
CREATE INDEX campo_tareas_empresa_id_equipo_campo_id_activo_idx
  ON campo_tareas(empresa_id,equipo_campo_id,activo);

ALTER TABLE campo_horarios ADD COLUMN equipo_campo_id INTEGER;
UPDATE campo_horarios h SET equipo_campo_id = g.id
FROM campo_locales l JOIN campo_clientes c ON c.id = l.cliente_id
JOIN campo_equipos_operativos g ON g.empresa_id = c.empresa_id
WHERE l.id = h.local_id AND g.tipo = h.destinatario;
ALTER TABLE campo_horarios ALTER COLUMN equipo_campo_id SET NOT NULL;
ALTER TABLE campo_horarios ADD CONSTRAINT campo_horarios_equipo_campo_id_fkey
  FOREIGN KEY (equipo_campo_id) REFERENCES campo_equipos_operativos(id) ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX campo_horarios_local_id_equipo_campo_id_activo_idx
  ON campo_horarios(local_id,equipo_campo_id,activo);

COMMIT;
