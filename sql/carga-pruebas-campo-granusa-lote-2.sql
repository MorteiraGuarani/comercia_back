-- Segundo lote de prueba para Mi jornada.
-- Agrega 10 locales a Carlos y 10 a Rodrigo, sin modificar el lote anterior.
-- Idempotente mediante la marca de semilla del lote 2.

BEGIN;

DO $validar$
DECLARE
  cantidad_usuarios integer;
  cantidad_empresas integer;
BEGIN
  SELECT COUNT(*), COUNT(DISTINCT empresa_id)
  INTO cantidad_usuarios, cantidad_empresas
  FROM usuarios
  WHERE lower(correo) IN (
    'carlosmorteira16@gmail.com',
    'comprasgn26@gmail.com'
  )
    AND is_active;

  IF cantidad_usuarios <> 2 OR cantidad_empresas <> 1 THEN
    RAISE EXCEPTION
      'Los dos usuarios activos de prueba deben existir en la misma empresa';
  END IF;
END
$validar$;

CREATE TEMP TABLE carga_granusa_lote_2 (
  codigo text PRIMARY KEY,
  cliente_nombre text NOT NULL,
  local_nombre text NOT NULL,
  direccion text NOT NULL,
  telefono text NOT NULL,
  latitud double precision NOT NULL,
  longitud double precision NOT NULL,
  asignar_a text NOT NULL
) ON COMMIT DROP;

-- Comercios reales consultados en Google Maps alrededor de Granusa.
-- Solo se incluyen datos publicos de ubicacion y telefono; no se inventan
-- RUC ni contactos personales.
INSERT INTO carga_granusa_lote_2 (
  codigo, cliente_nombre, local_nombre, direccion, telefono, latitud, longitud, asignar_a
) VALUES
  ('nortenita', 'Despensa La Norteñita', 'Despensa La Norteñita', 'JF77+CRH, Juan Emiliano O''Leary, Ñemby', '0985 895631', -25.3864471, -57.5353831, 'carlosmorteira16@gmail.com'),
  ('dos-hermanas', 'Despensa dos Hermanas', 'Despensa dos Hermanas', 'JF69+W4P, Ñemby', '', -25.3876612, -57.5321874, 'carlosmorteira16@gmail.com'),
  ('catorce-agosto', 'Despensa 14 de Agosto', 'Despensa 14 de Agosto', 'Ñemby, Departamento Central', '0961 580413', -25.3874375, -57.5145625, 'carlosmorteira16@gmail.com'),
  ('san-nicolas', 'Despensa San Nicolás', 'Despensa San Nicolás', 'JF5R+998, Ñemby', '0992 684693', -25.3915890, -57.5090498, 'carlosmorteira16@gmail.com'),
  ('santa-elena', 'Despensa Santa Elena', 'Despensa Santa Elena', 'JF9G+8C7, Cabildo, Ñemby', '0992 992962', -25.3817205, -57.5239619, 'carlosmorteira16@gmail.com'),
  ('despensa-dyd', 'Despensa D&D', 'Despensa D&D', 'Ñemby, Departamento Central', '0972 404856', -25.3805788, -57.5319553, 'carlosmorteira16@gmail.com'),
  ('ortega-diaz', 'Despensa Familia Ortega Diaz', 'Despensa Familia Ortega Diaz', 'Prof. Dr. Victorio Curiel, Ñemby', '', -25.3948771, -57.5362593, 'carlosmorteira16@gmail.com'),
  ('micawil', 'Ferretería Micawil', 'Ferretería Micawil', 'Ñemby, Departamento Central', '0984 731594', -25.3928100, -57.5384447, 'carlosmorteira16@gmail.com'),
  ('san-luis', 'Panadería - Confitería San Luis', 'Panadería - Confitería San Luis', 'JFF9+JJV, Ñemby', '', -25.3758793, -57.5309504, 'carlosmorteira16@gmail.com'),
  ('peripan', 'Panadería PeriPan', 'Panadería PeriPan', 'Divino Niño Jesús, Ñemby', '', -25.3804298, -57.5401034, 'carlosmorteira16@gmail.com'),
  ('las-hermanas', 'Despensa las Hermanas', 'Despensa las Hermanas', 'Ponciano Morán, Ñemby', '', -25.4008339, -57.5100886, 'comprasgn26@gmail.com'),
  ('san-cayetano', 'Despensa San Cayetano', 'Despensa San Cayetano', 'Ñemby, Departamento Central', '0984 749015', -25.3737036, -57.5399121, 'comprasgn26@gmail.com'),
  ('carmen-mbuchi', 'Despensa Ña Carmen y Mbuchi', 'Despensa Ña Carmen y Mbuchi', 'HFWJ+CVC, Ñemby', '0991 499911', -25.4039431, -57.5178636, 'comprasgn26@gmail.com'),
  ('dino', 'Despensa Dino', 'Despensa Dino', 'Ñemby, Departamento Central', '', -25.3733119, -57.5385684, 'comprasgn26@gmail.com'),
  ('ferrec', 'Ferreteria Ferrec', 'Ferreteria Ferrec', 'Uruguay, Ñemby', '0983 470558', -25.4030932, -57.5190016, 'comprasgn26@gmail.com'),
  ('ferreteria-dyg', 'Ferreteria D&G', 'Ferreteria D&G', 'Caaguazú 971, Ñemby', '0981 983157', -25.4102470, -57.5248569, 'comprasgn26@gmail.com'),
  ('las-delicias', 'Panadería Las Delicia', 'Panadería Las Delicia', 'JF86+7J3, Ñemby', '', -25.3843509, -57.5384462, 'comprasgn26@gmail.com'),
  ('favorito', 'Panadería El Favorito', 'Panadería El Favorito', 'Ñemby 111205', '', -25.3762922, -57.5383283, 'comprasgn26@gmail.com'),
  ('artesano', 'Panadería El Artesano', 'Panadería El Artesano', 'JFH9+758, Las Dalias, Ñemby', '', -25.3718400, -57.5320330, 'comprasgn26@gmail.com'),
  ('familia-monte-alto', 'Despensa La Familia Monte Alto', 'Despensa La Familia Monte Alto', 'Monte Alto, Ñemby', '0984 257821', -25.3942095, -57.5354893, 'comprasgn26@gmail.com');

INSERT INTO campo_clientes (empresa_id, nombre, ruc, contacto, telefono, activo)
SELECT u.empresa_id, f.cliente_nombre, '', '', '', true
FROM carga_granusa_lote_2 f
JOIN usuarios u ON lower(u.correo) = 'carlosmorteira16@gmail.com'
WHERE NOT EXISTS (
  SELECT 1
  FROM campo_clientes c
  WHERE c.empresa_id = u.empresa_id
    AND c.nombre = f.cliente_nombre
);

WITH locales_fuente AS (
  SELECT f.*, c.id AS cliente_id
  FROM carga_granusa_lote_2 f
  JOIN usuarios u ON lower(u.correo) = 'carlosmorteira16@gmail.com'
  JOIN LATERAL (
    SELECT id
    FROM campo_clientes
    WHERE empresa_id = u.empresa_id
      AND nombre = f.cliente_nombre
    ORDER BY id
    LIMIT 1
  ) c ON true
)
INSERT INTO campo_locales (
  cliente_id, nombre, direccion, contacto, telefono, latitud, longitud,
  radio_metros, zona_horaria, notas, activo
)
SELECT
  f.cliente_id,
  f.local_nombre,
  f.direccion,
  '',
  f.telefono,
  f.latitud,
  f.longitud,
  100,
  'America/Asuncion',
  'Carga de prueba lote 2: comercio cercano a Granusa; fuente Google Maps. [semilla=carga-campo-granusa-lote-2-2026-09-18]',
  true
FROM locales_fuente f
WHERE NOT EXISTS (
  SELECT 1
  FROM campo_locales l
  WHERE l.cliente_id = f.cliente_id
    AND l.nombre = f.local_nombre
    AND l.notas LIKE '%[semilla=carga-campo-granusa-lote-2-2026-09-18]%'
);

-- Misma configuracion operativa que el lote inicial: lunes a sabado, 07:00 a 18:00.
WITH locales_semilla AS (
  SELECT id
  FROM campo_locales
  WHERE notas LIKE '%[semilla=carga-campo-granusa-lote-2-2026-09-18]%'
)
INSERT INTO campo_horarios (
  local_id, frecuencia, intervalo, dias_semana, dias_mes,
  fecha_desde, fecha_hasta, entrada, salida, activo
)
SELECT
  l.id,
  'SEMANAL'::"FrecuenciaCampo",
  1,
  ARRAY[1, 2, 3, 4, 5, 6],
  ARRAY[]::integer[],
  (CURRENT_TIMESTAMP AT TIME ZONE 'America/Asuncion')::date,
  NULL,
  '07:00',
  '18:00',
  true
FROM locales_semilla l
WHERE NOT EXISTS (
  SELECT 1
  FROM campo_horarios h
  WHERE h.local_id = l.id
    AND h.activo
    AND h.frecuencia = 'SEMANAL'::"FrecuenciaCampo"
    AND h.intervalo = 1
    AND h.dias_semana = ARRAY[1, 2, 3, 4, 5, 6]
    AND h.entrada = '07:00'
    AND h.salida = '18:00'
);

WITH asignaciones_fuente AS (
  SELECT l.id AS local_id, u.id AS usuario_id
  FROM carga_granusa_lote_2 f
  JOIN usuarios empresa ON lower(empresa.correo) = 'carlosmorteira16@gmail.com'
  JOIN LATERAL (
    SELECT l.id
    FROM campo_clientes c
    JOIN campo_locales l ON l.cliente_id = c.id
    WHERE c.empresa_id = empresa.empresa_id
      AND c.nombre = f.cliente_nombre
      AND l.nombre = f.local_nombre
      AND l.notas LIKE '%[semilla=carga-campo-granusa-lote-2-2026-09-18]%'
    ORDER BY l.id
    LIMIT 1
  ) l ON true
  JOIN usuarios u
    ON lower(u.correo) = lower(f.asignar_a)
   AND u.empresa_id = empresa.empresa_id
   AND u.is_active
)
INSERT INTO campo_asignaciones (local_id, usuario_id, fecha_desde, fecha_hasta, activo)
SELECT
  f.local_id,
  f.usuario_id,
  (CURRENT_TIMESTAMP AT TIME ZONE 'America/Asuncion')::date,
  NULL,
  true
FROM asignaciones_fuente f
WHERE NOT EXISTS (
  SELECT 1
  FROM campo_asignaciones a
  WHERE a.local_id = f.local_id
    AND a.usuario_id = f.usuario_id
    AND a.activo
    AND a.fecha_desde <= (CURRENT_TIMESTAMP AT TIME ZONE 'America/Asuncion')::date
    AND (a.fecha_hasta IS NULL OR a.fecha_hasta >= (CURRENT_TIMESTAMP AT TIME ZONE 'America/Asuncion')::date)
);

SELECT
  u.correo,
  COUNT(DISTINCT a.id) FILTER (WHERE a.activo AND l.id IS NOT NULL) AS locales_lote_2,
  COUNT(DISTINCT h.id) FILTER (WHERE h.activo) AS horarios_lote_2
FROM usuarios u
LEFT JOIN campo_asignaciones a ON a.usuario_id = u.id
LEFT JOIN campo_locales l
  ON l.id = a.local_id
 AND l.notas LIKE '%[semilla=carga-campo-granusa-lote-2-2026-09-18]%'
LEFT JOIN campo_horarios h ON h.local_id = l.id
WHERE lower(u.correo) IN ('carlosmorteira16@gmail.com', 'comprasgn26@gmail.com')
GROUP BY u.correo
ORDER BY u.correo;

COMMIT;
