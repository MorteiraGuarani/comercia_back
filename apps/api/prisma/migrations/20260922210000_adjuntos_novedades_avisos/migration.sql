CREATE TABLE IF NOT EXISTS "campo_adjuntos" (
  "id" SERIAL NOT NULL,
  "empresa_id" INTEGER NOT NULL,
  "usuario_id" INTEGER NOT NULL,
  "novedad_id" INTEGER,
  "aviso_id" INTEGER,
  "nombre_original" VARCHAR(255) NOT NULL,
  "ruta_archivo" VARCHAR(500) NOT NULL,
  "mime_type" VARCHAR(50) NOT NULL,
  "tamanio_bytes" INTEGER NOT NULL,
  "creado_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "campo_adjuntos_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "campo_adjuntos_un_solo_origen_check"
    CHECK ((("novedad_id" IS NOT NULL)::integer + ("aviso_id" IS NOT NULL)::integer) = 1),
  CONSTRAINT "campo_adjuntos_tamanio_positivo_check" CHECK ("tamanio_bytes" > 0)
);

CREATE INDEX IF NOT EXISTS "campo_adjuntos_novedad_id_idx" ON "campo_adjuntos"("novedad_id");
CREATE INDEX IF NOT EXISTS "campo_adjuntos_aviso_id_idx" ON "campo_adjuntos"("aviso_id");
CREATE INDEX IF NOT EXISTS "campo_adjuntos_empresa_id_creado_at_idx" ON "campo_adjuntos"("empresa_id", "creado_at" DESC);

ALTER TABLE "campo_adjuntos"
  ADD CONSTRAINT "campo_adjuntos_empresa_id_fkey"
  FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "campo_adjuntos"
  ADD CONSTRAINT "campo_adjuntos_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "campo_adjuntos"
  ADD CONSTRAINT "campo_adjuntos_novedad_id_fkey"
  FOREIGN KEY ("novedad_id") REFERENCES "campo_novedades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "campo_adjuntos"
  ADD CONSTRAINT "campo_adjuntos_aviso_id_fkey"
  FOREIGN KEY ("aviso_id") REFERENCES "campo_avisos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
