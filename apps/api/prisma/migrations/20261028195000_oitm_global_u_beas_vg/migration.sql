BEGIN;
-- Reemplazo solicitado: el maestro pasa a ser global y se desvincula de las
-- tablas de precios e inventario. Los precios se vuelven a cargar desde SAP.
DELETE FROM "tbl_itm1";
DROP TABLE "tbl_oitm" CASCADE;
CREATE TABLE "tbl_oitm" (
  "ItemCode" VARCHAR(15) NOT NULL,
  "ItemName" VARCHAR(200),
  "TaxCodeAR" SMALLINT,
  "ItmsGrpCod" SMALLINT DEFAULT -1,
  "QryInventario" VARCHAR(1) DEFAULT 'N',
  "SWeight1" NUMERIC(21,6),
  "DfltWH" VARCHAR(10),
  "validFor" VARCHAR(1) DEFAULT 'Y',
  "frozenFor" VARCHAR(1) DEFAULT 'N',
  "U_ItemQty" NUMERIC(21,6),
  "U_beas_vg" VARCHAR(50),
  CONSTRAINT "uq_tbl_ocrd_itemcode" UNIQUE ("ItemCode")
);

-- La entrega puede preparar los archivos en esta tabla temporal de despliegue.
-- Si existe, todo el reemplazo y ambas cargas se confirman en una transacción.
DO $$
DECLARE importacion RECORD;
BEGIN
  IF to_regclass('public._oitm_import_20261028') IS NULL THEN RETURN; END IF;
  SELECT * INTO STRICT importacion FROM public._oitm_import_20261028;
  IF jsonb_array_length(importacion.oitm) <> 1122 OR jsonb_array_length(importacion.itm1) <> 6537
     OR NOT EXISTS (SELECT 1 FROM empresas WHERE id = importacion.empresa_id) THEN
    RAISE EXCEPTION 'La importación de OITM/ITM1 está incompleta';
  END IF;
  INSERT INTO tbl_oitm ("ItemCode", "ItemName", "TaxCodeAR", "ItmsGrpCod", "QryInventario", "SWeight1", "DfltWH", "validFor", "frozenFor", "U_ItemQty", "U_beas_vg")
  SELECT "ItemCode", "ItemName", "TaxCodeAR", "ItmsGrpCod", "QryInventario", "SWeight1", "DfltWH", "validFor", "frozenFor", "U_ItemQty", "U_beas_vg"
  FROM jsonb_to_recordset(importacion.oitm) AS x("ItemCode" varchar, "ItemName" varchar, "TaxCodeAR" smallint, "ItmsGrpCod" smallint, "QryInventario" varchar, "SWeight1" numeric, "DfltWH" varchar, "validFor" varchar, "frozenFor" varchar, "U_ItemQty" numeric, "U_beas_vg" varchar);
  INSERT INTO tbl_itm1 (empresa_id, "ItemCode", "PriceList", "Price")
  SELECT importacion.empresa_id, x."ItemCode", x."PriceList", x."Price"
  FROM jsonb_to_recordset(importacion.itm1) AS x("ItemCode" varchar, "PriceList" integer, "Price" numeric);
  IF (SELECT count(*) FROM tbl_oitm) <> 1122 OR (SELECT count(*) FROM tbl_itm1) <> 6537
     OR EXISTS (SELECT 1 FROM tbl_itm1 p LEFT JOIN tbl_oitm o ON o."ItemCode" = p."ItemCode" WHERE o."ItemCode" IS NULL) THEN
    RAISE EXCEPTION 'La importación de OITM/ITM1 no pasó la verificación';
  END IF;
  DROP TABLE public._oitm_import_20261028;
END $$;
COMMIT;
