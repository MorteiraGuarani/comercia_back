-- Active y Locked de tbl_oslp pasan a 4 caracteres (SAP puede enviar "tYES"/"tNO"). Solo amplía: no pierde datos.
ALTER TABLE "tbl_oslp"
    ALTER COLUMN "Active" TYPE VARCHAR(4),
    ALTER COLUMN "Locked" TYPE VARCHAR(4);
