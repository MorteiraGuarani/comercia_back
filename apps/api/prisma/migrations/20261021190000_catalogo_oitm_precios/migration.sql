BEGIN;
SET LOCAL lock_timeout = '15s';
LOCK TABLE "tbl_itm1", "tbl_ospp", "tbl_spp1" IN ACCESS EXCLUSIVE MODE;

-- Ante cualquier incompatibilidad se aborta todo; no truncar códigos, agrupar
-- precios especiales distintos ni inventar claves para filas incompletas.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM tbl_itm1 WHERE length(itemcode)>15 OR itmsgrpcode NOT BETWEEN -32768 AND 32767) THEN
    RAISE EXCEPTION 'Articulos incompatibles con ItemCode varchar(15) o ItmsGrpCod int2';
  END IF;
  IF EXISTS (SELECT 1 FROM tbl_itm1 GROUP BY empresa_id,itemcode HAVING count(DISTINCT (itemname,iva,itmsgrpcode,inventory,tipo))>1) THEN
    RAISE EXCEPTION 'Datos generales distintos para el mismo articulo entre listas';
  END IF;
  IF EXISTS (SELECT 1 FROM tbl_ospp WHERE itemcode IS NULL OR cardcode IS NULL OR listpricecod IS NULL OR valid IS NULL) THEN
    RAISE EXCEPTION 'Precios especiales con claves o Valid nulos';
  END IF;
  IF EXISTS (SELECT 1 FROM tbl_ospp GROUP BY empresa_id,itemcode,cardcode,listpricecod HAVING count(*)>1) THEN
    RAISE EXCEPTION 'Precios especiales duplicados para la nueva clave';
  END IF;
  IF EXISTS (SELECT 1 FROM tbl_spp1 WHERE itemcode IS NULL OR cardcode IS NULL OR linenum IS NULL OR listnum IS NULL) THEN
    RAISE EXCEPTION 'Detalle de precios con claves nulas';
  END IF;
END $$;

CREATE TABLE "tbl_oitm" (
  "id" BIGSERIAL PRIMARY KEY,
  "empresa_id" INTEGER NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  "ItemCode" VARCHAR(15) NOT NULL,
  "ItemName" VARCHAR(200),
  "TaxCodeAR" SMALLINT,
  "ItmsGrpCod" SMALLINT DEFAULT -1,
  "QryInventario" VARCHAR(1) DEFAULT 'N',
  "validFor" VARCHAR(1) DEFAULT 'Y',
  "frozenFor" VARCHAR(1) DEFAULT 'N',
  "TIPO" VARCHAR(50)
);
CREATE UNIQUE INDEX "uq_tbl_ocrd_itemcode" ON "tbl_oitm" (empresa_id,"ItemCode");
CREATE INDEX "idx_tbl_oitm_itemname" ON "tbl_oitm" (empresa_id,"ItemName");
INSERT INTO tbl_oitm(empresa_id,"ItemCode","ItemName","TaxCodeAR","ItmsGrpCod","QryInventario","TIPO")
 SELECT DISTINCT empresa_id,itemcode,itemname,iva,itmsgrpcode,inventory,tipo FROM tbl_itm1;

-- Los nombres de listas pertenecen al catálogo ya existente; no sobrescribirlo.
INSERT INTO tbl_opln(empresa_id,"ListNum","ListName")
 SELECT DISTINCT ON (empresa_id,pricelist) empresa_id,pricelist,pricelistname
 FROM tbl_itm1 WHERE pricelistname IS NOT NULL
 ORDER BY empresa_id,pricelist,id
 ON CONFLICT DO NOTHING;

-- Guardar la información retirada de las tablas activas en un archivo relacional
-- de solo respaldo. No es un origen de datos de la API ni contiene nuevas reglas.
CREATE SCHEMA "respaldo_catalogo_20261021";
CREATE TABLE respaldo_catalogo_20261021.tbl_itm1 AS TABLE public.tbl_itm1;
CREATE TABLE respaldo_catalogo_20261021.tbl_ospp AS TABLE public.tbl_ospp;
CREATE TABLE respaldo_catalogo_20261021.tbl_spp1 AS TABLE public.tbl_spp1;
REVOKE ALL ON SCHEMA respaldo_catalogo_20261021 FROM PUBLIC;

ALTER TABLE tbl_itm1 DROP CONSTRAINT tbl_itm1_pkey;
DROP INDEX idx_tbl_itm1_itemcode;
DROP INDEX idx_tbl_itm1_itemname;
DROP INDEX idx_tbl_itm1_itmsgrpcode;
DROP INDEX idx_tbl_itm1_pricelist;
DROP INDEX idx_tbl_itm1_tipo;
ALTER TABLE tbl_itm1 DROP COLUMN itemname, DROP COLUMN iva, DROP COLUMN itmsgrpcode,
  DROP COLUMN itmsgrpnam, DROP COLUMN inventory, DROP COLUMN pricelistname, DROP COLUMN tipo;
ALTER TABLE tbl_itm1 RENAME COLUMN itemcode TO "ItemCode";
ALTER TABLE tbl_itm1 RENAME COLUMN pricelist TO "PriceList";
ALTER TABLE tbl_itm1 RENAME COLUMN price TO "Price";
ALTER TABLE tbl_itm1 ALTER COLUMN "PriceList" TYPE INTEGER;
ALTER TABLE tbl_itm1 ADD CONSTRAINT "PK_tbl_itm1" PRIMARY KEY(empresa_id,"ItemCode","PriceList");
ALTER TABLE tbl_itm1 ADD CONSTRAINT "tbl_itm1_producto_fkey" FOREIGN KEY(empresa_id,"ItemCode")
  REFERENCES tbl_oitm(empresa_id,"ItemCode") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX idx_tbl_itm1_pricelist ON tbl_itm1(empresa_id,"PriceList");

ALTER TABLE tbl_ospp DROP CONSTRAINT tbl_ospp_pkey;
DROP INDEX uq_tbl_ospp_item_listprice;
ALTER TABLE tbl_ospp DROP COLUMN cardname, DROP COLUMN cardtype, DROP COLUMN listpricename,
  DROP COLUMN itemname, DROP COLUMN um, DROP COLUMN itmsgrpcode, DROP COLUMN itmsgrpnam;
ALTER TABLE tbl_ospp RENAME COLUMN itemcode TO "ItemCode";
ALTER TABLE tbl_ospp RENAME COLUMN cardcode TO "CardCode";
ALTER TABLE tbl_ospp RENAME COLUMN price TO "Price";
ALTER TABLE tbl_ospp RENAME COLUMN listpricecod TO "ListNum";
ALTER TABLE tbl_ospp RENAME COLUMN valid TO "Valid";
ALTER TABLE tbl_ospp ALTER COLUMN "ItemCode" SET NOT NULL, ALTER COLUMN "CardCode" SET NOT NULL,
  ALTER COLUMN "ListNum" SET NOT NULL, ALTER COLUMN "Valid" TYPE VARCHAR(1),
  ALTER COLUMN "Valid" SET NOT NULL, ALTER COLUMN "Price" DROP DEFAULT,
  ADD COLUMN "Currency" VARCHAR(10), ADD COLUMN "Discount" NUMERIC(21,6);
ALTER TABLE tbl_ospp ADD CONSTRAINT "PK_tbl_ospp" PRIMARY KEY(empresa_id,"ItemCode","CardCode","ListNum");
CREATE UNIQUE INDEX uq_tbl_ospp_id ON tbl_ospp(id);
CREATE INDEX idx_tbl_ospp_cardcode ON tbl_ospp(empresa_id,"CardCode");

ALTER TABLE tbl_spp1 DROP CONSTRAINT tbl_spp1_pkey;
DROP INDEX uq_tbl_spp1;
DROP INDEX idx_tbl_spp1_itemcode;
DROP INDEX idx_tbl_spp1_currency;
DROP INDEX idx_tbl_spp1_validity;
ALTER TABLE tbl_spp1 DROP COLUMN fromdate, DROP COLUMN todate;
ALTER TABLE tbl_spp1 RENAME COLUMN itemcode TO "ItemCode";
ALTER TABLE tbl_spp1 RENAME COLUMN cardcode TO "CardCode";
ALTER TABLE tbl_spp1 RENAME COLUMN linenum TO "LINENUM";
ALTER TABLE tbl_spp1 RENAME COLUMN price TO "Price";
ALTER TABLE tbl_spp1 RENAME COLUMN currency TO "Currency";
ALTER TABLE tbl_spp1 RENAME COLUMN discount TO "Discount";
ALTER TABLE tbl_spp1 RENAME COLUMN listnum TO "ListNum";
ALTER TABLE tbl_spp1 ALTER COLUMN "ItemCode" SET NOT NULL,
  ALTER COLUMN "CardCode" TYPE VARCHAR(50), ALTER COLUMN "CardCode" SET NOT NULL,
  ALTER COLUMN "LINENUM" TYPE INTEGER, ALTER COLUMN "LINENUM" SET NOT NULL,
  ALTER COLUMN "Currency" TYPE VARCHAR(10), ALTER COLUMN "ListNum" TYPE INTEGER,
  ALTER COLUMN "ListNum" DROP DEFAULT, ALTER COLUMN "ListNum" SET NOT NULL;
ALTER TABLE tbl_spp1 ADD CONSTRAINT "PK_tbl_spp1" PRIMARY KEY(empresa_id,"ItemCode","CardCode","ListNum","LINENUM");
CREATE UNIQUE INDEX uq_tbl_spp1_id ON tbl_spp1(id);
CREATE INDEX idx_tbl_spp1_cardcode ON tbl_spp1(empresa_id,"CardCode");

CREATE TABLE tbl_spp2 (
  id BIGSERIAL NOT NULL,
  empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  "ItemCode" VARCHAR(50) NOT NULL,
  "CardCode" VARCHAR(50) NOT NULL,
  "SPP1Lnum" INTEGER,
  "SPP2LNum" INTEGER,
  "Amount" NUMERIC(21,6),
  "Price" NUMERIC(21,6),
  "Discount" NUMERIC(21,6),
  CONSTRAINT pk_tbl_ssp2 PRIMARY KEY(empresa_id,"ItemCode","CardCode")
);
CREATE UNIQUE INDEX uq_tbl_spp2_id ON tbl_spp2(id);
CREATE INDEX idx_tbl_spp2_cardcode ON tbl_spp2(empresa_id,"CardCode");
COMMIT;
