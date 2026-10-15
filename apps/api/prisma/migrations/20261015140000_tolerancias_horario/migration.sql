-- No modifica ni recalifica marcaciones históricas.
CREATE TABLE "configuraciones_tolerancia" (
  "clave" VARCHAR(80) PRIMARY KEY,
  "empresa_id" INTEGER,
  "valores" JSONB NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "configuraciones_tolerancia_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "configuraciones_tolerancia_empresa_id_idx" ON "configuraciones_tolerancia"("empresa_id");
ALTER TABLE "campo_visitas"
  ADD COLUMN "tolerancias_aplicadas" JSONB,
  ADD COLUMN "entrada_color" VARCHAR(8),
  ADD COLUMN "salida_color" VARCHAR(8);
