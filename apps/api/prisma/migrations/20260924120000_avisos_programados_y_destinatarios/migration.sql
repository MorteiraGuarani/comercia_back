ALTER TYPE "TipoAvisoCampo" ADD VALUE 'SELECCION';

CREATE TYPE "FrecuenciaAvisoCampo" AS ENUM ('UNA_VEZ', 'HORARIA', 'DIARIA', 'SEMANAL', 'MENSUAL');

CREATE TABLE "campo_aviso_programaciones" (
  "id" SERIAL NOT NULL,
  "empresa_id" INTEGER NOT NULL,
  "emisor_id" INTEGER NOT NULL,
  "tipo" "TipoAvisoCampo" NOT NULL,
  "destinatarios_ids" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  "mensaje" VARCHAR(1000) NOT NULL,
  "frecuencia" "FrecuenciaAvisoCampo" NOT NULL,
  "fecha_inicio" VARCHAR(10) NOT NULL,
  "hora" VARCHAR(5) NOT NULL,
  "intervalo_horas" INTEGER,
  "dias_semana" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  "dia_mes" INTEGER,
  "fecha_fin" VARCHAR(10),
  "proximo_envio_at" TIMESTAMP(3) NOT NULL,
  "ultimo_envio_at" TIMESTAMP(3),
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "creado_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "campo_aviso_programaciones_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "campo_avisos" ADD COLUMN "programacion_id" INTEGER;
ALTER TABLE "campo_avisos" ADD COLUMN "instante_programado" TIMESTAMP(3);

CREATE TABLE "campo_aviso_destinatarios" (
  "aviso_id" INTEGER NOT NULL,
  "usuario_id" INTEGER NOT NULL,
  CONSTRAINT "campo_aviso_destinatarios_pkey" PRIMARY KEY ("aviso_id", "usuario_id")
);

ALTER TABLE "campo_adjuntos" ADD COLUMN "programacion_id" INTEGER;

CREATE INDEX "campo_aviso_programaciones_activo_proximo_envio_at_idx" ON "campo_aviso_programaciones"("activo", "proximo_envio_at");
CREATE INDEX "campo_aviso_programaciones_emisor_id_creado_at_idx" ON "campo_aviso_programaciones"("emisor_id", "creado_at" DESC);
CREATE UNIQUE INDEX "campo_avisos_programacion_id_instante_programado_key" ON "campo_avisos"("programacion_id", "instante_programado");
CREATE INDEX "campo_aviso_destinatarios_usuario_id_idx" ON "campo_aviso_destinatarios"("usuario_id");
CREATE INDEX "campo_adjuntos_programacion_id_idx" ON "campo_adjuntos"("programacion_id");

ALTER TABLE "campo_aviso_programaciones" ADD CONSTRAINT "campo_aviso_programaciones_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "campo_aviso_programaciones" ADD CONSTRAINT "campo_aviso_programaciones_emisor_id_fkey" FOREIGN KEY ("emisor_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "campo_avisos" ADD CONSTRAINT "campo_avisos_programacion_id_fkey" FOREIGN KEY ("programacion_id") REFERENCES "campo_aviso_programaciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "campo_aviso_destinatarios" ADD CONSTRAINT "campo_aviso_destinatarios_aviso_id_fkey" FOREIGN KEY ("aviso_id") REFERENCES "campo_avisos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "campo_aviso_destinatarios" ADD CONSTRAINT "campo_aviso_destinatarios_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "campo_adjuntos" ADD CONSTRAINT "campo_adjuntos_programacion_id_fkey" FOREIGN KEY ("programacion_id") REFERENCES "campo_aviso_programaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
