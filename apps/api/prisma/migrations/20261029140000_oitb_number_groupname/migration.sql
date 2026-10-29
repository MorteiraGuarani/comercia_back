-- El usuario autorizó descartar los grupos anteriores. Los campos técnicos
-- de empresa e id se conservan para mantener el aislamiento del catálogo.
BEGIN;
DELETE FROM "tbl_oitb";
ALTER TABLE "tbl_oitb" RENAME COLUMN "ItmsGrpCod" TO "Number";
ALTER TABLE "tbl_oitb" RENAME COLUMN "ItmsGrpNam" TO "GroupName";
COMMIT;
