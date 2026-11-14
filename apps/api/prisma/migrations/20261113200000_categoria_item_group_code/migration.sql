-- La categoría guarda el grupo de artículos de SAP: tbl_oitb."Number" (OITM.ItemsGroupCode).
ALTER TABLE "campo_categoria" RENAME COLUMN "codesap" TO "ItemGroupCode";

-- Las pestañas de Pedidos salen de esta tabla (Modo I = pestaña propia, G u otro = Otros).
-- Para no perder las pestañas fijas de hoy, la empresa sin categorías arranca con
-- Hamburguesas (144), Embutidos (145) y Pollo (241), solo si tiene esos grupos en OITB.
INSERT INTO "campo_categoria" ("empresa_id", "nombre_categoria", "ItemGroupCode", "Modo", "orden")
SELECT g."empresa_id", v."nombre", v."grupo", 'I', v."orden"
FROM (VALUES ('Hamburguesas', 144, 1), ('Embutidos', 145, 2), ('Pollo', 241, 3)) AS v("nombre", "grupo", "orden")
JOIN "tbl_oitb" g ON g."Number" = v."grupo"
WHERE NOT EXISTS (SELECT 1 FROM "campo_categoria" c WHERE c."empresa_id" = g."empresa_id");
