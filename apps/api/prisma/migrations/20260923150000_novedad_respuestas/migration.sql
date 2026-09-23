ALTER TYPE "TipoNotificacionCampo" ADD VALUE 'NOVEDAD_RESPUESTA';

CREATE TABLE "campo_novedad_respuestas" (
    "id" SERIAL NOT NULL,
    "novedad_id" INTEGER NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "mensaje" VARCHAR(1000) NOT NULL,
    "creado_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "campo_novedad_respuestas_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "campo_novedad_respuestas_novedad_id_creado_at_id_idx"
    ON "campo_novedad_respuestas"("novedad_id", "creado_at", "id");

ALTER TABLE "campo_novedad_respuestas"
    ADD CONSTRAINT "campo_novedad_respuestas_novedad_id_fkey"
    FOREIGN KEY ("novedad_id") REFERENCES "campo_novedades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "campo_novedad_respuestas"
    ADD CONSTRAINT "campo_novedad_respuestas_usuario_id_fkey"
    FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
