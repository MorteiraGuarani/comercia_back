-- Crear tipos enum
CREATE TYPE "EstadoTareaCampo" AS ENUM ('ABIERTA', 'CERRADA', 'CANCELADA');
CREATE TYPE "TipoNovedadCampo" AS ENUM ('RECLAMO', 'CONSULTA', 'SUGERENCIA', 'INCIDENCIA');
CREATE TYPE "EstadoNovedadCampo" AS ENUM ('ABIERTA', 'CERRADA', 'CANCELADA');
CREATE TYPE "PrioridadNovedadCampo" AS ENUM ('NORMAL', 'ALTA', 'CRITICA');
CREATE TYPE "TipoAvisoCampo" AS ENUM ('INDIVIDUAL', 'EQUIPO');

-- Agregar valores al enum TipoNotificacionCampo
ALTER TYPE "TipoNotificacionCampo" ADD VALUE IF NOT EXISTS 'NOVEDAD_CREADA';
ALTER TYPE "TipoNotificacionCampo" ADD VALUE IF NOT EXISTS 'NOVEDAD_ACTUALIZADA';
ALTER TYPE "TipoNotificacionCampo" ADD VALUE IF NOT EXISTS 'AVISO_RECIBIDO';

-- Agregar campos a campo_tareas
ALTER TABLE "campo_tareas" ADD COLUMN IF NOT EXISTS "categoria" VARCHAR(60) NOT NULL DEFAULT 'Relevamiento';
ALTER TABLE "campo_tareas" ADD COLUMN IF NOT EXISTS "estado" "EstadoTareaCampo" NOT NULL DEFAULT 'ABIERTA';
ALTER TABLE "campo_tareas" ADD COLUMN IF NOT EXISTS "es_obligatoria" BOOLEAN NOT NULL DEFAULT false;

-- Crear tabla campo_novedades
CREATE TABLE IF NOT EXISTS "campo_novedades" (
  "id" SERIAL PRIMARY KEY,
  "empresa_id" INT NOT NULL REFERENCES "empresas"("id") ON DELETE CASCADE,
  "usuario_id" INT NOT NULL REFERENCES "usuarios"("id") ON DELETE RESTRICT,
  "local_id" INT NOT NULL REFERENCES "campo_locales"("id") ON DELETE CASCADE,
  "visita_id" INT REFERENCES "campo_visitas"("id") ON DELETE SET NULL,
  "tarea_id" INT REFERENCES "campo_tareas"("id") ON DELETE SET NULL,
  "tipo" "TipoNovedadCampo" NOT NULL DEFAULT 'INCIDENCIA',
  "estado" "EstadoNovedadCampo" NOT NULL DEFAULT 'ABIERTA',
  "prioridad" "PrioridadNovedadCampo" NOT NULL DEFAULT 'NORMAL',
  "titulo" VARCHAR(120) NOT NULL,
  "descripcion" VARCHAR(1000) NOT NULL,
  "resolucion" VARCHAR(1000),
  "cerrado_por_id" INT REFERENCES "usuarios"("id") ON DELETE SET NULL,
  "cerrado_at" TIMESTAMP(3),
  "creado_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "campo_novedades_empresa_id_estado_creado_at_idx" ON "campo_novedades"("empresa_id", "estado", "creado_at" DESC);
CREATE INDEX IF NOT EXISTS "campo_novedades_usuario_id_estado_idx" ON "campo_novedades"("usuario_id", "estado");
CREATE INDEX IF NOT EXISTS "campo_novedades_local_id_estado_idx" ON "campo_novedades"("local_id", "estado");
CREATE INDEX IF NOT EXISTS "campo_novedades_tarea_id_idx" ON "campo_novedades"("tarea_id");

-- Crear tabla campo_avisos
CREATE TABLE IF NOT EXISTS "campo_avisos" (
  "id" SERIAL PRIMARY KEY,
  "empresa_id" INT NOT NULL REFERENCES "empresas"("id") ON DELETE CASCADE,
  "emisor_id" INT NOT NULL REFERENCES "usuarios"("id") ON DELETE RESTRICT,
  "tipo" "TipoAvisoCampo" NOT NULL DEFAULT 'EQUIPO',
  "destinatario_id" INT REFERENCES "usuarios"("id") ON DELETE CASCADE,
  "mensaje" VARCHAR(1000) NOT NULL,
  "creado_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "campo_avisos_empresa_id_creado_at_idx" ON "campo_avisos"("empresa_id", "creado_at" DESC);
CREATE INDEX IF NOT EXISTS "campo_avisos_emisor_id_creado_at_idx" ON "campo_avisos"("emisor_id", "creado_at" DESC);
CREATE INDEX IF NOT EXISTS "campo_avisos_destinatario_id_creado_at_idx" ON "campo_avisos"("destinatario_id", "creado_at" DESC);

-- Crear tabla campo_aviso_lecturas
CREATE TABLE IF NOT EXISTS "campo_aviso_lecturas" (
  "id" SERIAL PRIMARY KEY,
  "aviso_id" INT NOT NULL REFERENCES "campo_avisos"("id") ON DELETE CASCADE,
  "usuario_id" INT NOT NULL REFERENCES "usuarios"("id") ON DELETE CASCADE,
  "leido_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("aviso_id", "usuario_id")
);

CREATE INDEX IF NOT EXISTS "campo_aviso_lecturas_usuario_id_idx" ON "campo_aviso_lecturas"("usuario_id");

-- Registrar las nuevas páginas en los módulos
INSERT INTO paginas(modulo_id, nombre, ruta, orden, activo, updated_at, icono)
SELECT m.id, p.nombre, p.ruta, p.orden, true, CURRENT_TIMESTAMP, p.icono FROM modulos m
CROSS JOIN (VALUES
  ('Novedades del equipo', 'novedades', 5, 'alerta'),
  ('Avisos al equipo', 'avisos', 6, 'comunicacion')
) AS p(nombre,ruta,orden,icono)
WHERE m.ruta = 'gestion-campo' ON CONFLICT (modulo_id,ruta) DO NOTHING;

INSERT INTO paginas(modulo_id, nombre, ruta, orden, activo, updated_at, icono)
SELECT m.id, p.nombre, p.ruta, p.orden, true, CURRENT_TIMESTAMP, p.icono FROM modulos m
CROSS JOIN (VALUES
  ('Mis novedades', 'novedades', 3, 'alerta'),
  ('Mis avisos', 'avisos', 4, 'comunicacion')
) AS p(nombre,ruta,orden,icono)
WHERE m.ruta = 'mi-jornada' ON CONFLICT (modulo_id,ruta) DO NOTHING;
