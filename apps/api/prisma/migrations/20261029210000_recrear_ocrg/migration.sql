-- La recreacion solicitada elimina los registros anteriores de tbl_ocrg.
DROP TABLE "tbl_ocrg";
CREATE TABLE "tbl_ocrg" (
  "id" BIGSERIAL PRIMARY KEY,
  "empresa_id" INTEGER NOT NULL REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "Code" INTEGER,
  "Name" VARCHAR(200),
  "Type" VARCHAR(200)
);
CREATE UNIQUE INDEX "uq_tbl_ocrg_empresa_clave" ON "tbl_ocrg" ("empresa_id", "Code") NULLS NOT DISTINCT;
CREATE INDEX "idx_tbl_ocrg_name" ON "tbl_ocrg" ("empresa_id", "Name");
