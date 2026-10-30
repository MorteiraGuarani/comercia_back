-- La recreacion solicitada elimina los registros anteriores de tbl_omrc.
DROP TABLE "tbl_omrc";
CREATE TABLE "tbl_omrc" (
  "id" BIGSERIAL PRIMARY KEY,
  "empresa_id" INTEGER NOT NULL REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "Code" INTEGER,
  "ManufacturerName" VARCHAR(250)
);
CREATE UNIQUE INDEX "uq_tbl_omrc_empresa_clave" ON "tbl_omrc" ("empresa_id", "Code") NULLS NOT DISTINCT;
