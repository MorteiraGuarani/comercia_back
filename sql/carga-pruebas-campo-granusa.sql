-- Carga operativa de prueba para Mi jornada.
-- Alcance: Frigorifico Guarani; ejecutable tanto en local como en produccion.
-- Es idempotente: conserva clientes previos y solo crea los locales marcados
-- con la semilla indicada. La fecha del reemplazo es el dia de ejecucion en
-- America/Asuncion.

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

  IF cantidad_usuarios <> 2 THEN
    RAISE EXCEPTION
      'Deben existir y estar activos los dos usuarios de prueba (encontrados: %)',
      cantidad_usuarios;
  END IF;

  IF cantidad_empresas <> 1 THEN
    RAISE EXCEPTION
      'Los usuarios de prueba deben pertenecer a una sola empresa (encontradas: %)',
      cantidad_empresas;
  END IF;
END
$validar$;

CREATE TEMP TABLE carga_granusa (
  codigo text PRIMARY KEY,
  cliente_nombre text NOT NULL,
  local_nombre text NOT NULL,
  direccion text NOT NULL,
  telefono text NOT NULL,
  latitud double precision NOT NULL,
  longitud double precision NOT NULL,
  asignar_a text NOT NULL
) ON COMMIT DROP;

-- Comercios reales consultados en Google Maps alrededor de
-- GRANOS Y NUTRICION S.A. (-25.3900862, -57.5242317). Se cargan solamente
-- datos publicos de ubicacion/telefono; RUC y contacto quedan vacios para no
-- inventar datos comerciales o personales.
INSERT INTO carga_granusa (
  codigo, cliente_nombre, local_nombre, direccion, telefono, latitud, longitud, asignar_a
) VALUES
  ('luisito', 'Hipermercado Luisito Ñemby', 'Hipermercado Luisito Ñemby', 'Av. Manuel Ortiz Guerrero, Ñemby', '(021) 238 5073', -25.3890146, -57.5243286, 'carlosmorteira16@gmail.com'),
  ('ahorra', 'Tienda A Ver Si AHORRA', 'Tienda A Ver Si AHORRA', 'Av. Manuel Ortiz Guerrero, Ñemby', '0994 719763', -25.3886738, -57.5250870, 'carlosmorteira16@gmail.com'),
  ('pira-raity', 'PIRA RAITY Restobar', 'PIRA RAITY Restobar', 'JF6G+84P, Ñemby', '0994 830480', -25.3891569, -57.5246726, 'carlosmorteira16@gmail.com'),
  ('bazar-verduras', 'Bazar y Verduras', 'Bazar y Verduras', 'JF6F+GW7, Ñemby', '', -25.3887005, -57.5252034, 'carlosmorteira16@gmail.com'),
  ('despensa-4-hermanos', 'Despensa 4 Hermanos', 'Despensa 4 Hermanos', 'Ñemby, Departamento Central', '0981 250482', -25.3864955, -57.5257548, 'carlosmorteira16@gmail.com'),
  ('despensa-margarita', 'Despensa Margarita', 'Despensa Margarita', 'JF5C+GJX, La Lomita, Ñemby', '', -25.3911283, -57.5283860, 'carlosmorteira16@gmail.com'),
  ('alimarket', 'AliMarket', 'AliMarket', 'La Lomita 894, Ñemby', '0981 152464', -25.3965779, -57.5241190, 'carlosmorteira16@gmail.com'),
  ('estanciero', 'EL ESTANCIERO', 'EL ESTANCIERO', 'JF4F+96M, Ñemby', '0983 256327', -25.3940312, -57.5269534, 'carlosmorteira16@gmail.com'),
  ('le-burguer', 'L&E Burguer', 'L&E Burguer', 'JF6J+83Q, Ñemby', '0994 116980', -25.3891522, -57.5197506, 'carlosmorteira16@gmail.com'),
  ('fyc-minimarket', 'FYC MINIMARKET', 'FYC MINIMARKET', 'Santa Rosa, Ñemby', '0987 112160', -25.3917387, -57.5320460, 'carlosmorteira16@gmail.com'),
  ('real-nemby-2', 'Supermercado Real Ñemby 2', 'Supermercado Real Ñemby 2', 'Bernardino Caballero entre Primera Junta Municipal, Ñemby', '0987 313500', -25.3944556, -57.5426970, 'comprasgn26@gmail.com'),
  ('superseis', 'Superseis Ñemby', 'Superseis Ñemby', 'JF44+J99, Ñemby', '(021) 414 1960', -25.3934509, -57.5440193, 'comprasgn26@gmail.com'),
  ('gran-via', 'Supermercado Gran Vía - ELID S.A.', 'Supermercado Gran Vía - ELID S.A.', 'Acceso Sur, Ñemby', '0991 975486', -25.3954616, -57.5454823, 'comprasgn26@gmail.com'),
  ('farmatotal', 'FARMATOTAL - Suc. Manuel Ortiz Guerrero esq. La Lomita', 'FARMATOTAL - Suc. Manuel Ortiz Guerrero esq. La Lomita', 'Manuel Ortiz Guerrero esq. La Lomita, Ñemby', '0972 962999', -25.3935519, -57.5275257, 'comprasgn26@gmail.com'),
  ('farmacenter', 'Farmacenter Ñemby', 'Farmacenter Ñemby', 'Acceso Sur esq., Ñemby', '(021) 262 6000', -25.3964149, -57.5447368, 'comprasgn26@gmail.com'),
  ('punto-farma-368', 'Punto Farma - Local 368', 'Punto Farma - Local 368', 'Av. Moisés Bertoni, Ñemby', '0976 405372', -25.3785054, -57.5281564, 'comprasgn26@gmail.com'),
  ('catedral-nemby', 'Farmacias Catedral Suc. Ñemby', 'Farmacias Catedral Suc. Ñemby', 'Ñemby, Departamento Central', '0981 783861', -25.3967689, -57.5457964, 'comprasgn26@gmail.com'),
  ('punto-farma-acceso-sur', 'Punto Farma Acceso Sur', 'Punto Farma Acceso Sur', 'Ruta Acceso Sur, Ñemby', '(021) 616 1000', -25.3885271, -57.5480354, 'comprasgn26@gmail.com'),
  ('catedral-nemby-3', 'Farmacias Catedral Suc. Ñemby 3', 'Farmacias Catedral Suc. Ñemby 3', 'Ñemby, Departamento Central', '0983 502272', -25.3953167, -57.5479766, 'comprasgn26@gmail.com'),
  ('farmacia-daniels', 'Farmacia Daniels', 'Farmacia Daniels', 'Av. Pratt Gill casi, Ñemby', '0981 853098', -25.3861922, -57.5487808, 'comprasgn26@gmail.com');

-- Habilita Mi jornada para los roles concretos de los dos usuarios y conserva
-- los roles ya habilitados en la empresa.
INSERT INTO empresa_modulos (empresa_id, modulo_id, todas_las_paginas, rol_ids)
SELECT u.empresa_id, m.id, true, ARRAY_AGG(DISTINCT u.rol_id) FILTER (WHERE u.rol_id IS NOT NULL)
FROM usuarios u
CROSS JOIN modulos m
WHERE lower(u.correo) IN ('carlosmorteira16@gmail.com', 'comprasgn26@gmail.com')
  AND m.ruta = 'mi-jornada'
GROUP BY u.empresa_id, m.id
ON CONFLICT (empresa_id, modulo_id) DO UPDATE
SET
  todas_las_paginas = true,
  rol_ids = ARRAY(
    SELECT DISTINCT rol_id
    FROM unnest(COALESCE(empresa_modulos.rol_ids, ARRAY[]::integer[]) || EXCLUDED.rol_ids) AS rol_id
    ORDER BY rol_id
  );

INSERT INTO campo_clientes (empresa_id, nombre, ruc, contacto, telefono, activo)
SELECT u.empresa_id, f.cliente_nombre, '', '', '', true
FROM carga_granusa f
JOIN usuarios u ON lower(u.correo) = 'carlosmorteira16@gmail.com'
WHERE NOT EXISTS (
  SELECT 1
  FROM campo_clientes c
  WHERE c.empresa_id = u.empresa_id
    AND c.nombre = f.cliente_nombre
);

WITH locales_fuente AS (
  SELECT
    f.*,
    c.id AS cliente_id
  FROM carga_granusa f
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
  'Carga de prueba: comercio cercano a Granusa; fuente Google Maps. [semilla=carga-campo-granusa-2026-09-18]',
  true
FROM locales_fuente f
WHERE NOT EXISTS (
  SELECT 1
  FROM campo_locales l
  WHERE l.cliente_id = f.cliente_id
    AND l.nombre = f.local_nombre
    AND l.notas LIKE '%[semilla=carga-campo-granusa-2026-09-18]%'
);

-- Una franja semanal para lunes (1) a sabado (6), 07:00 a 18:00,
-- vigente desde hoy en America/Asuncion.
WITH locales_semilla AS (
  SELECT l.id
  FROM campo_locales l
  WHERE l.notas LIKE '%[semilla=carga-campo-granusa-2026-09-18]%'
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
  SELECT
    l.id AS local_id,
    u.id AS usuario_id
  FROM carga_granusa f
  JOIN usuarios empresa ON lower(empresa.correo) = 'carlosmorteira16@gmail.com'
  JOIN LATERAL (
    SELECT l.id
    FROM campo_clientes c
    JOIN campo_locales l ON l.cliente_id = c.id
    WHERE c.empresa_id = empresa.empresa_id
      AND c.nombre = f.cliente_nombre
      AND l.nombre = f.local_nombre
      AND l.notas LIKE '%[semilla=carga-campo-granusa-2026-09-18]%'
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

-- Hoy Carlos reemplaza a Rodrigo en FARMATOTAL; la fecha se fija al momento
-- de la primera ejecucion y no se duplica en reejecuciones posteriores.
WITH reemplazo AS (
  SELECT
    a.id AS asignacion_id,
    carlos.id AS usuario_id,
    (CURRENT_TIMESTAMP AT TIME ZONE 'America/Asuncion')::date AS fecha
  FROM usuarios empresa
  JOIN usuarios rodrigo
    ON lower(rodrigo.correo) = 'comprasgn26@gmail.com'
   AND rodrigo.empresa_id = empresa.empresa_id
  JOIN usuarios carlos
    ON lower(carlos.correo) = 'carlosmorteira16@gmail.com'
   AND carlos.empresa_id = empresa.empresa_id
  JOIN campo_clientes c
    ON c.empresa_id = empresa.empresa_id
   AND c.nombre = 'FARMATOTAL - Suc. Manuel Ortiz Guerrero esq. La Lomita'
  JOIN campo_locales l
    ON l.cliente_id = c.id
   AND l.nombre = 'FARMATOTAL - Suc. Manuel Ortiz Guerrero esq. La Lomita'
   AND l.notas LIKE '%[semilla=carga-campo-granusa-2026-09-18]%'
  JOIN campo_asignaciones a
    ON a.local_id = l.id
   AND a.usuario_id = rodrigo.id
   AND a.activo
   AND a.fecha_desde <= (CURRENT_TIMESTAMP AT TIME ZONE 'America/Asuncion')::date
   AND (a.fecha_hasta IS NULL OR a.fecha_hasta >= (CURRENT_TIMESTAMP AT TIME ZONE 'America/Asuncion')::date)
  WHERE lower(empresa.correo) = 'carlosmorteira16@gmail.com'
)
INSERT INTO campo_backups (
  asignacion_id, usuario_id, fecha_desde, fecha_hasta, motivo, activo
)
SELECT
  r.asignacion_id,
  r.usuario_id,
  r.fecha,
  r.fecha,
  'Prueba de reemplazo operativo de carga inicial',
  true
FROM reemplazo r
WHERE NOT EXISTS (
  SELECT 1
  FROM campo_backups b
  WHERE b.asignacion_id = r.asignacion_id
    AND b.usuario_id = r.usuario_id
    AND b.motivo = 'Prueba de reemplazo operativo de carga inicial'
);

-- Resumen de validacion visible al ejecutar el archivo.
SELECT
  u.correo,
  COUNT(DISTINCT a.id) FILTER (WHERE a.activo AND l.id IS NOT NULL) AS locales_asignados_activos,
  COUNT(DISTINCT b.id) FILTER (
    WHERE b.activo
      AND b.fecha_desde = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Asuncion')::date
      AND local_reemplazo.id IS NOT NULL
  ) AS reemplazos_hoy
FROM usuarios u
LEFT JOIN campo_asignaciones a ON a.usuario_id = u.id
LEFT JOIN campo_locales l
  ON l.id = a.local_id
 AND l.notas LIKE '%[semilla=carga-campo-granusa-2026-09-18]%'
LEFT JOIN campo_backups b ON b.usuario_id = u.id
LEFT JOIN campo_asignaciones asignacion_reemplazo ON asignacion_reemplazo.id = b.asignacion_id
LEFT JOIN campo_locales local_reemplazo
  ON local_reemplazo.id = asignacion_reemplazo.local_id
 AND local_reemplazo.notas LIKE '%[semilla=carga-campo-granusa-2026-09-18]%'
WHERE lower(u.correo) IN ('carlosmorteira16@gmail.com', 'comprasgn26@gmail.com')
GROUP BY u.correo
ORDER BY u.correo;

COMMIT;
