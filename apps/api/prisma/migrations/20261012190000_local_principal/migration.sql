ALTER TABLE "usuarios" ADD COLUMN "local_principal_id" INTEGER;
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_local_principal_id_fkey" FOREIGN KEY ("local_principal_id") REFERENCES "campo_locales"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "usuarios_local_principal_id_idx" ON "usuarios"("local_principal_id");
