-- Campo nuevo de SAP en almacenes; admite nulos, no toca las filas existentes.
ALTER TABLE "tbl_owhs" ADD COLUMN "AddressName2" VARCHAR(150);
