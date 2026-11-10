-- Banderas de tbl_oitm a 4 caracteres (SAP puede mandar "tYES"/"tNO") y sin
-- valor por defecto en la base. Solo amplía el tipo: no borra ni cambia filas.
ALTER TABLE tbl_oitm
ALTER COLUMN "validFor" TYPE varchar(4),
ALTER COLUMN "validFor" DROP DEFAULT,
ALTER COLUMN "frozenFor" TYPE varchar(4),
ALTER COLUMN "frozenFor" DROP DEFAULT,
ALTER COLUMN "QryInventario" TYPE varchar(4),
ALTER COLUMN "QryInventario" DROP DEFAULT;
