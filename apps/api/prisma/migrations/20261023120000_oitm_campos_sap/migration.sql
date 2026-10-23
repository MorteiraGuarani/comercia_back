-- tbl_oitm: se vacía para volver a cargarla desde SAP y suma SWeight1, DfltWH
-- y U_ItemQty. Por pedido del usuario no se toca ninguna otra tabla: los
-- artículos que todavía usan los precios (tbl_itm1) o el inventario de algún
-- local se conservan (sus claves foráneas no permiten borrarlos sin borrar
-- también esos datos).
DELETE FROM "tbl_oitm" o
WHERE NOT EXISTS (
    SELECT 1 FROM "tbl_itm1" p
    WHERE p."empresa_id" = o."empresa_id" AND p."ItemCode" = o."ItemCode"
  )
  AND NOT EXISTS (
    SELECT 1 FROM "campo_inventario_productos" i
    WHERE i."empresa_id" = o."empresa_id" AND i."ItemCode" = o."ItemCode"
  )
  AND NOT EXISTS (
    SELECT 1 FROM "campo_inventario_cargas" c
    WHERE c."empresa_id" = o."empresa_id" AND c."ItemCode" = o."ItemCode"
  );

ALTER TABLE "tbl_oitm" ADD COLUMN "SWeight1" DECIMAL(21,6),
ADD COLUMN "DfltWH" VARCHAR(10),
ADD COLUMN "U_ItemQty" DECIMAL(21,6);
