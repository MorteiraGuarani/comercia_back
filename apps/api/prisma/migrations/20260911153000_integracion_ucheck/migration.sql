ALTER TABLE "campo_locales"
  ADD COLUMN "radio_metros" INTEGER NOT NULL DEFAULT 100,
  ADD COLUMN "zona_horaria" VARCHAR(80) NOT NULL DEFAULT 'America/Asuncion';

ALTER TABLE "campo_visitas"
  ADD COLUMN "origen" VARCHAR(16) NOT NULL DEFAULT 'COMERCIA',
  ADD COLUMN "ucheck_jornada_id" INTEGER,
  ADD COLUMN "entrada_precision" DOUBLE PRECISION,
  ADD COLUMN "entrada_distancia" DOUBLE PRECISION,
  ADD COLUMN "entrada_fuera_horario" BOOLEAN,
  ADD COLUMN "entrada_fuera_atencion" BOOLEAN,
  ADD COLUMN "salida_precision" DOUBLE PRECISION,
  ADD COLUMN "salida_distancia" DOUBLE PRECISION,
  ADD COLUMN "salida_fuera_horario" BOOLEAN,
  ADD COLUMN "salida_fuera_atencion" BOOLEAN;

CREATE UNIQUE INDEX "campo_visitas_ucheck_jornada_id_key"
  ON "campo_visitas"("ucheck_jornada_id");

CREATE TYPE "TipoEventoUcheck" AS ENUM ('ENTRADA', 'SALIDA');

CREATE TABLE "integracion_ucheck_eventos" (
  "id" VARCHAR(80) NOT NULL,
  "tipo" "TipoEventoUcheck" NOT NULL,
  "ucheck_jornada_id" INTEGER NOT NULL,
  "usuario_id" INTEGER NOT NULL,
  "empresa_id" INTEGER NOT NULL,
  "visita_id" INTEGER NOT NULL,
  "local_id" INTEGER NOT NULL,
  "asignacion_id" INTEGER NOT NULL,
  "horario_id" INTEGER,
  "correo_usuario" VARCHAR(254) NOT NULL,
  "registrada_en" TIMESTAMP(3) NOT NULL,
  "capturada_en" TIMESTAMP(3) NOT NULL,
  "recibida_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "latitud" DOUBLE PRECISION NOT NULL,
  "longitud" DOUBLE PRECISION NOT NULL,
  "precision_metros" DOUBLE PRECISION NOT NULL,
  "distancia_metros" DOUBLE PRECISION NOT NULL,
  "centro_latitud" DOUBLE PRECISION NOT NULL,
  "centro_longitud" DOUBLE PRECISION NOT NULL,
  "radio_metros" INTEGER NOT NULL,
  "hora_desde" VARCHAR(5),
  "hora_hasta" VARCHAR(5),
  "fuera_horario" BOOLEAN NOT NULL,
  "fuera_atencion" BOOLEAN NOT NULL,
  "ubicacion_simulada" BOOLEAN NOT NULL,
  "contexto_dispositivo" JSONB,
  CONSTRAINT "integracion_ucheck_eventos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "integracion_ucheck_eventos_ucheck_jornada_id_tipo_key"
  ON "integracion_ucheck_eventos"("ucheck_jornada_id", "tipo");
CREATE INDEX "integracion_ucheck_eventos_empresa_id_registrada_en_idx"
  ON "integracion_ucheck_eventos"("empresa_id", "registrada_en" DESC);
CREATE INDEX "integracion_ucheck_eventos_usuario_id_registrada_en_idx"
  ON "integracion_ucheck_eventos"("usuario_id", "registrada_en" DESC);

ALTER TABLE "integracion_ucheck_eventos" ADD CONSTRAINT "integracion_ucheck_eventos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "integracion_ucheck_eventos" ADD CONSTRAINT "integracion_ucheck_eventos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "integracion_ucheck_eventos" ADD CONSTRAINT "integracion_ucheck_eventos_visita_id_fkey" FOREIGN KEY ("visita_id") REFERENCES "campo_visitas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "integracion_ucheck_eventos" ADD CONSTRAINT "integracion_ucheck_eventos_local_id_fkey" FOREIGN KEY ("local_id") REFERENCES "campo_locales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "integracion_ucheck_eventos" ADD CONSTRAINT "integracion_ucheck_eventos_asignacion_id_fkey" FOREIGN KEY ("asignacion_id") REFERENCES "campo_asignaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "integracion_ucheck_eventos" ADD CONSTRAINT "integracion_ucheck_eventos_horario_id_fkey" FOREIGN KEY ("horario_id") REFERENCES "campo_horarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
