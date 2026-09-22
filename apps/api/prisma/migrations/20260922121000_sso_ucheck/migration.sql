CREATE TABLE "identidades_ucheck" (
  "id" SERIAL NOT NULL,
  "usuario_id" INTEGER NOT NULL,
  "ucheck_usuario_id" INTEGER NOT NULL,
  "correo_vinculado" VARCHAR(254) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "identidades_ucheck_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "identidades_ucheck_usuario_id_key"
  ON "identidades_ucheck"("usuario_id");
CREATE UNIQUE INDEX "identidades_ucheck_ucheck_usuario_id_key"
  ON "identidades_ucheck"("ucheck_usuario_id");

ALTER TABLE "identidades_ucheck"
  ADD CONSTRAINT "identidades_ucheck_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
