-- Estructura definitiva de SAP para socios, supervisores y vendedores.
-- Sin DROP de tablas: se conservan los datos y empresa_id.

-- tbl_ocrd: AliasName (texto libre) reemplaza a CardFName; lo cargado se conserva.
ALTER TABLE "tbl_ocrd" RENAME COLUMN "CardFName" TO "AliasName";
ALTER TABLE "tbl_ocrd" ALTER COLUMN "AliasName" SET DATA TYPE TEXT;

-- tbl_oagp
ALTER TABLE "tbl_oagp" ADD COLUMN "Memo" VARCHAR(200);

-- tbl_oslp
ALTER TABLE "tbl_oslp" ADD COLUMN "Memo" VARCHAR(200),
ADD COLUMN "Active" VARCHAR(1) NOT NULL DEFAULT 'Y',
ADD COLUMN "Fax" VARCHAR(200);
