-- La pertenencia del local se conserva aunque se elimine su cliente.
ALTER TABLE "campo_clientes" ADD COLUMN "eliminado_en" TIMESTAMP(3);
ALTER TABLE "campo_locales" ADD COLUMN "empresa_id" INTEGER,
  ADD COLUMN "eliminado_en" TIMESTAMP(3);

UPDATE "campo_locales" AS l
SET "empresa_id" = c."empresa_id"
FROM "campo_clientes" AS c
WHERE l."cliente_id" = c."id";

ALTER TABLE "campo_locales" ALTER COLUMN "empresa_id" SET NOT NULL,
  ALTER COLUMN "cliente_id" DROP NOT NULL;

CREATE UNIQUE INDEX "campo_clientes_id_empresa_id_key" ON "campo_clientes"("id", "empresa_id");
ALTER TABLE "campo_locales" DROP CONSTRAINT "campo_locales_cliente_id_fkey";
ALTER TABLE "campo_locales" ADD CONSTRAINT "campo_locales_empresa_id_fkey"
  FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "campo_locales" ADD CONSTRAINT "campo_locales_cliente_id_empresa_id_fkey"
  FOREIGN KEY ("cliente_id", "empresa_id") REFERENCES "campo_clientes"("id", "empresa_id")
  ON DELETE NO ACTION ON UPDATE NO ACTION;
CREATE INDEX "campo_locales_empresa_id_eliminado_en_nombre_idx"
  ON "campo_locales"("empresa_id", "eliminado_en", "nombre");
