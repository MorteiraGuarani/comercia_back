-- Campos ERP originales, con identificador interno y aislamiento por empresa.
-- Las referencias de codigos son logicas para admitir cargas en cualquier orden.
BEGIN;
CREATE TABLE "tbl_omrc" (
  "id" BIGSERIAL PRIMARY KEY,
  "empresa_id" INTEGER NOT NULL REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "FirmCode" INTEGER,
  "FirmName" VARCHAR(200)
);
CREATE UNIQUE INDEX "uq_tbl_omrc_empresa_clave" ON "tbl_omrc" ("empresa_id", "FirmCode") NULLS NOT DISTINCT;

CREATE TABLE "tbl_oscn" (
  "id" BIGSERIAL PRIMARY KEY,
  "empresa_id" INTEGER NOT NULL REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "ItemCode" VARCHAR(100) NOT NULL,
  "CardCode" VARCHAR(200) NOT NULL,
  "Substitute" VARCHAR(200) NOT NULL,
  "Descriptio" VARCHAR(300)
);
CREATE UNIQUE INDEX "uq_tbl_oscn_empresa_clave" ON "tbl_oscn" ("empresa_id", "ItemCode", "CardCode", "Substitute");

CREATE TABLE "tbl_oitb" (
  "id" BIGSERIAL PRIMARY KEY,
  "empresa_id" INTEGER NOT NULL REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "ItmsGrpCod" INTEGER NOT NULL,
  "ItmsGrpNam" VARCHAR(200)
);
CREATE UNIQUE INDEX "uq_tbl_oitb_empresa_clave" ON "tbl_oitb" ("empresa_id", "ItmsGrpCod");

CREATE TABLE "tbl_jtiposubcanales" (
  "id" BIGSERIAL PRIMARY KEY,
  "empresa_id" INTEGER NOT NULL REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "Code" VARCHAR(50) NOT NULL,
  "U_Descripcion" VARCHAR(120)
);
CREATE UNIQUE INDEX "uq_tbl_jtiposubcanales_empresa_clave" ON "tbl_jtiposubcanales" ("empresa_id", "Code");
COMMIT;
