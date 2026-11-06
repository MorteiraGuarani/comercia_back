-- Pestaña SAP del usuario: almacén (código y nombre) y código de usuario SAP.
-- Solo cambia columnas: la tabla y sus filas quedan. El código de almacén
-- anterior pasa a ERP_CodigoAlmacen antes de quitar las cuatro columnas viejas;
-- supervisor, vendedor e impulsador se pierden (pedido del usuario).
ALTER TABLE "usuarios"
  ADD COLUMN IF NOT EXISTS "ERP_CodigoAlmacen" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "ERP_NombreAlmacen" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "ERP_CodUsuarioSap" VARCHAR(100);

UPDATE "usuarios"
SET "ERP_CodigoAlmacen" = "ERP_Almacen"
WHERE "ERP_Almacen" IS NOT NULL AND "ERP_CodigoAlmacen" IS NULL;

ALTER TABLE "usuarios"
  DROP COLUMN IF EXISTS "ERP_Almacen",
  DROP COLUMN IF EXISTS "ERP_Supervisor",
  DROP COLUMN IF EXISTS "ERP_Vendedor",
  DROP COLUMN IF EXISTS "ERP_Impulsador";
