-- Nueva bandera de SAP en tbl_oitm. Columna nullable sin default: no toca filas existentes.
ALTER TABLE tbl_oitm ADD COLUMN "QryGroup3" varchar(4);
