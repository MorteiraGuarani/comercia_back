-- Pedido del usuario: tbl_oitm se vacía para volver a cargarla desde SAP con
-- Properties3 (tYES/tNO), que reemplaza a QryInventario como filtro de Inventario.
-- QryGroup3 se retira. Ninguna tabla referencia tbl_oitm por clave foránea.
DELETE FROM "tbl_oitm";
ALTER TABLE "tbl_oitm" DROP COLUMN "QryInventario";
ALTER TABLE "tbl_oitm" DROP COLUMN "QryGroup3";
ALTER TABLE "tbl_oitm" ADD COLUMN "Properties3" VARCHAR(4);
