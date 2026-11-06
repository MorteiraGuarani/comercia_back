-- Sucursal del usuario en el ERP: Code de tbl_oclp de su empresa (sin FK: tbl_oclp se recarga por bulk).
ALTER TABLE "usuarios" ADD COLUMN IF NOT EXISTS "ERP_Sucursal" INTEGER;
