-- Mejoras al módulo de tareas: comentarios, fotos y notificaciones
-- Fecha: 2026-09-14

-- ============================================================================
-- 1. TIPOS ENUM
-- ============================================================================

-- Tipo de notificación para el módulo de campo
CREATE TYPE "TipoNotificacionCampo" AS ENUM (
  'COMENTARIO_TAREA',
  'TAREA_COMPLETADA',
  'FOTO_SUBIDA'
);

-- Momento en que se toma la foto (antes o después de la tarea)
CREATE TYPE "MomentoFotoCampo" AS ENUM (
  'ANTES',
  'DESPUES'
);

-- ============================================================================
-- 2. MODIFICAR TABLA EXISTENTE: campo_tareas
-- ============================================================================

-- Agregar campos para configuración de fotos
ALTER TABLE "campo_tareas" 
  ADD COLUMN "requiere_fotos" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "fotos_obligatorias" BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN "campo_tareas"."requiere_fotos" IS 'Si esta tarea habilita la carga de fotos antes/después';
COMMENT ON COLUMN "campo_tareas"."fotos_obligatorias" IS 'Si es obligatorio subir ambas fotos para completar la tarea';

-- ============================================================================
-- 3. MODIFICAR TABLA EXISTENTE: campo_cumplimientos
-- ============================================================================

-- Agregar flag de validación de fotos
ALTER TABLE "campo_cumplimientos"
  ADD COLUMN "fotos_validadas" BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN "campo_cumplimientos"."fotos_validadas" IS 'TRUE si cumplió con el requisito de fotos (o si no las requiere)';

-- ============================================================================
-- 4. NUEVA TABLA: campo_tarea_comentarios
-- ============================================================================

CREATE TABLE "campo_tarea_comentarios" (
  "id" SERIAL PRIMARY KEY,
  "cumplimiento_visita_id" INTEGER NOT NULL,
  "cumplimiento_tarea_id" INTEGER NOT NULL,
  "usuario_id" INTEGER NOT NULL,
  "comentario" VARCHAR(500) NOT NULL,
  "creado_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "leido_por_lider" BOOLEAN NOT NULL DEFAULT FALSE,
  "leido_at" TIMESTAMP,
  
  CONSTRAINT "fk_comentario_cumplimiento" 
    FOREIGN KEY ("cumplimiento_visita_id", "cumplimiento_tarea_id") 
    REFERENCES "campo_cumplimientos"("visita_id", "tarea_id") 
    ON DELETE CASCADE,
  
  CONSTRAINT "fk_comentario_usuario" 
    FOREIGN KEY ("usuario_id") 
    REFERENCES "usuarios"("id") 
    ON DELETE RESTRICT
);

-- Índices para comentarios
CREATE INDEX "idx_comentarios_cumplimiento" 
  ON "campo_tarea_comentarios"("cumplimiento_visita_id", "cumplimiento_tarea_id");

CREATE INDEX "idx_comentarios_usuario" 
  ON "campo_tarea_comentarios"("usuario_id");

CREATE INDEX "idx_comentarios_no_leidos" 
  ON "campo_tarea_comentarios"("leido_por_lider", "creado_at") 
  WHERE "leido_por_lider" = FALSE;

COMMENT ON TABLE "campo_tarea_comentarios" IS 'Comentarios de impulsadores en tareas completadas';

-- ============================================================================
-- 5. NUEVA TABLA: campo_tarea_fotos
-- ============================================================================

CREATE TABLE "campo_tarea_fotos" (
  "id" SERIAL PRIMARY KEY,
  "cumplimiento_visita_id" INTEGER NOT NULL,
  "cumplimiento_tarea_id" INTEGER NOT NULL,
  "usuario_id" INTEGER NOT NULL,
  "momento" "MomentoFotoCampo" NOT NULL,
  "ruta_archivo" VARCHAR(500) NOT NULL,
  "mime_type" VARCHAR(50) NOT NULL,
  "tamanio_bytes" INTEGER NOT NULL,
  "creado_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  
  CONSTRAINT "fk_foto_cumplimiento" 
    FOREIGN KEY ("cumplimiento_visita_id", "cumplimiento_tarea_id") 
    REFERENCES "campo_cumplimientos"("visita_id", "tarea_id") 
    ON DELETE CASCADE,
  
  CONSTRAINT "fk_foto_usuario" 
    FOREIGN KEY ("usuario_id") 
    REFERENCES "usuarios"("id") 
    ON DELETE RESTRICT,
  
  CONSTRAINT "chk_foto_tamanio_positivo"
    CHECK ("tamanio_bytes" > 0)
);

-- Índices para fotos
CREATE INDEX "idx_fotos_cumplimiento" 
  ON "campo_tarea_fotos"("cumplimiento_visita_id", "cumplimiento_tarea_id");

CREATE INDEX "idx_fotos_usuario" 
  ON "campo_tarea_fotos"("usuario_id");

-- Índice único: solo una foto por momento (antes o después)
CREATE UNIQUE INDEX "idx_fotos_unica_por_momento" 
  ON "campo_tarea_fotos"("cumplimiento_visita_id", "cumplimiento_tarea_id", "momento");

COMMENT ON TABLE "campo_tarea_fotos" IS 'Fotos antes/después de tareas completadas';

-- ============================================================================
-- 6. NUEVA TABLA: campo_notificaciones
-- ============================================================================

CREATE TABLE "campo_notificaciones" (
  "id" SERIAL PRIMARY KEY,
  "empresa_id" INTEGER NOT NULL,
  "usuario_destinatario_id" INTEGER NOT NULL,
  "usuario_emisor_id" INTEGER NOT NULL,
  "tipo" "TipoNotificacionCampo" NOT NULL,
  "referencia_id" INTEGER,
  "titulo" VARCHAR(100) NOT NULL,
  "mensaje" VARCHAR(250) NOT NULL,
  "creado_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "leido" BOOLEAN NOT NULL DEFAULT FALSE,
  "leido_at" TIMESTAMP,
  
  CONSTRAINT "fk_notif_empresa" 
    FOREIGN KEY ("empresa_id") 
    REFERENCES "empresas"("id") 
    ON DELETE CASCADE,
  
  CONSTRAINT "fk_notif_destinatario" 
    FOREIGN KEY ("usuario_destinatario_id") 
    REFERENCES "usuarios"("id") 
    ON DELETE CASCADE,
  
  CONSTRAINT "fk_notif_emisor" 
    FOREIGN KEY ("usuario_emisor_id") 
    REFERENCES "usuarios"("id") 
    ON DELETE CASCADE
);

-- Índices para notificaciones
CREATE INDEX "idx_notif_destinatario" 
  ON "campo_notificaciones"("usuario_destinatario_id", "leido", "creado_at" DESC);

CREATE INDEX "idx_notif_empresa" 
  ON "campo_notificaciones"("empresa_id", "creado_at" DESC);

CREATE INDEX "idx_notif_tipo_referencia"
  ON "campo_notificaciones"("tipo", "referencia_id");

COMMENT ON TABLE "campo_notificaciones" IS 'Sistema de notificaciones para módulo de campo';

-- ============================================================================
-- 7. DATOS INICIALES (OPCIONAL)
-- ============================================================================

-- No hay datos iniciales necesarios, todas las tablas empiezan vacías
-- Las tareas existentes tendrán requiere_fotos=false por el DEFAULT

-- ============================================================================
-- 8. VERIFICACIONES DE INTEGRIDAD
-- ============================================================================

-- Verificar que las foreign keys están correctamente creadas
DO $$
BEGIN
  -- Verificar FK de comentarios
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_comentario_cumplimiento'
    AND table_name = 'campo_tarea_comentarios'
  ) THEN
    RAISE EXCEPTION 'FK fk_comentario_cumplimiento no creada correctamente';
  END IF;
  
  -- Verificar FK de fotos
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_foto_cumplimiento'
    AND table_name = 'campo_tarea_fotos'
  ) THEN
    RAISE EXCEPTION 'FK fk_foto_cumplimiento no creada correctamente';
  END IF;
  
  -- Verificar FK de notificaciones
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_notif_empresa'
    AND table_name = 'campo_notificaciones'
  ) THEN
    RAISE EXCEPTION 'FK fk_notif_empresa no creada correctamente';
  END IF;
  
  RAISE NOTICE 'Migración completada exitosamente';
END $$;
