BEGIN;

-- Unificar productos y precios sin cambiar los IDs de los precios existentes.
-- Se conserva empresa_id para mantener el aislamiento del catálogo actual.
LOCK TABLE "productos", "precios" IN ACCESS EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "precios"
    GROUP BY "empresa_id", "cardcode", "nro_lista_precio" HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'tbl_itm1: hay precios duplicados por empresa, artículo y lista; resolverlos antes de migrar';
  END IF;
  IF EXISTS (SELECT 1 FROM "precios" WHERE "nro_lista_precio" NOT BETWEEN -32768 AND 32767)
     OR EXISTS (SELECT 1 FROM "productos" WHERE "iva" NOT BETWEEN -32768 AND 32767 OR char_length("tipo") > 50) THEN
    RAISE EXCEPTION 'tbl_itm1: hay valores fuera del rango SMALLINT o tipo con más de 50 caracteres; corregirlos antes de migrar';
  END IF;
END $$;

ALTER TABLE "precios" DROP CONSTRAINT "precios_empresa_id_cardcode_fkey";
ALTER TABLE "precios" DROP CONSTRAINT "precios_nro_lista_precio_check";
ALTER TABLE "precios" DROP CONSTRAINT "precios_precio_check";
DROP INDEX "precios_empresa_id_cardcode_nro_lista_precio_idx";
ALTER TABLE "precios" RENAME TO "tbl_itm1";
ALTER TABLE "tbl_itm1" RENAME COLUMN "cardcode" TO "itemcode";
ALTER TABLE "tbl_itm1" RENAME COLUMN "nro_lista_precio" TO "pricelist";
ALTER TABLE "tbl_itm1" RENAME COLUMN "lista_precio" TO "pricelistname";
ALTER TABLE "tbl_itm1" RENAME COLUMN "precio" TO "price";
ALTER TABLE "tbl_itm1" RENAME CONSTRAINT "precios_pkey" TO "tbl_itm1_pkey";
ALTER TABLE "tbl_itm1" RENAME CONSTRAINT "precios_empresa_id_fkey" TO "tbl_itm1_empresa_id_fkey";
ALTER TABLE "tbl_itm1"
  ALTER COLUMN "id" TYPE BIGINT,
  ALTER COLUMN "pricelist" TYPE SMALLINT,
  ALTER COLUMN "pricelistname" DROP NOT NULL,
  ALTER COLUMN "price" DROP NOT NULL,
  ADD COLUMN "itemname" VARCHAR(200),
  ADD COLUMN "iva" SMALLINT,
  ADD COLUMN "itmsgrpcode" INTEGER,
  ADD COLUMN "itmsgrpnam" VARCHAR(200),
  ADD COLUMN "inventory" CHAR(1) DEFAULT 'Y',
  ADD COLUMN "tipo" VARCHAR(50);
ALTER SEQUENCE "precios_id_seq" RENAME TO "tbl_itm1_id_seq";
ALTER SEQUENCE "tbl_itm1_id_seq" AS BIGINT;

UPDATE "tbl_itm1" i SET
  "itemname" = p."descripcion",
  "iva" = p."iva",
  "itmsgrpcode" = p."grupo",
  "itmsgrpnam" = p."nombre_grupo",
  "inventory" = CASE WHEN p."inventario" THEN 'Y' ELSE 'N' END,
  "tipo" = p."tipo"
FROM "productos" p
WHERE p."empresa_id" = i."empresa_id" AND p."cardcode" = i."itemcode";

-- Los artículos sin precios se conservan con lista 0 y precio/nombre de lista
-- NULL. No se inventa un importe y quedan disponibles para completar su lista.
INSERT INTO "tbl_itm1" (
  "empresa_id", "itemcode", "itemname", "iva", "itmsgrpcode",
  "itmsgrpnam", "inventory", "pricelist", "tipo"
)
SELECT p."empresa_id", p."cardcode", p."descripcion", p."iva", p."grupo",
  p."nombre_grupo", CASE WHEN p."inventario" THEN 'Y' ELSE 'N' END, 0, p."tipo"
FROM "productos" p
WHERE NOT EXISTS (
  SELECT 1 FROM "tbl_itm1" i
  WHERE i."empresa_id" = p."empresa_id" AND i."itemcode" = p."cardcode"
);

ALTER TABLE "tbl_itm1"
  ALTER COLUMN "itemname" SET NOT NULL,
  ALTER COLUMN "iva" SET NOT NULL,
  ALTER COLUMN "itmsgrpcode" SET NOT NULL,
  ADD CONSTRAINT "uq_tbl_itm1_item_pricelist" UNIQUE ("empresa_id", "itemcode", "pricelist");
CREATE INDEX "idx_tbl_itm1_itemcode" ON "tbl_itm1" ("itemcode");
CREATE INDEX "idx_tbl_itm1_itemname" ON "tbl_itm1" ("itemname");
CREATE INDEX "idx_tbl_itm1_itmsgrpcode" ON "tbl_itm1" ("itmsgrpcode");
CREATE INDEX "idx_tbl_itm1_pricelist" ON "tbl_itm1" ("pricelist");
CREATE INDEX "idx_tbl_itm1_tipo" ON "tbl_itm1" ("tipo");
DROP TABLE "productos";

COMMIT;
