BEGIN;

LOCK TABLE "tbl_itm1" IN ACCESS EXCLUSIVE MODE;

-- Clave de negocio por empresa: un artículo admite varias listas, pero no
-- puede repetirse dentro de la misma lista y empresa. No se modifica ninguna fila.
-- El ID conserva su secuencia y unicidad para las URLs existentes de la API.
ALTER TABLE "tbl_itm1" ADD CONSTRAINT "uq_tbl_itm1_id" UNIQUE ("id");
ALTER TABLE "tbl_itm1" DROP CONSTRAINT "tbl_itm1_pkey";
ALTER TABLE "tbl_itm1" ADD CONSTRAINT "tbl_itm1_pkey"
  PRIMARY KEY ("empresa_id", "itemcode", "pricelist");
ALTER TABLE "tbl_itm1" DROP CONSTRAINT "uq_tbl_itm1_item_pricelist";

COMMIT;
