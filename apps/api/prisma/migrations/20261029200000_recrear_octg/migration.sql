-- La recreación solicitada elimina los registros anteriores de tbl_octg.
DROP TABLE "tbl_octg";

CREATE TABLE "tbl_octg" (
  "id" BIGSERIAL PRIMARY KEY,
  "empresa_id" INTEGER NOT NULL REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "GroupNumber" INTEGER,
  "PaymentTermsGroupName" VARCHAR(250),
  "PriceListNo" INTEGER
);
CREATE UNIQUE INDEX "uq_tbl_octg_empresa_clave" ON "tbl_octg" ("empresa_id", "GroupNumber") NULLS NOT DISTINCT;
CREATE INDEX "idx_tbl_octg_paymenttermsgroupname" ON "tbl_octg" ("empresa_id", "PaymentTermsGroupName");
