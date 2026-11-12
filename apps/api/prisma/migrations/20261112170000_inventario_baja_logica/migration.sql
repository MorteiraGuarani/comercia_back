-- Eliminar una carga de inventario la marca como eliminada y la conserva.
-- Solo agrega columnas nulas: las cargas existentes quedan vigentes.
ALTER TABLE "campo_inventario_cargas" ADD COLUMN "eliminada_en" TIMESTAMP(3);
ALTER TABLE "campo_inventario_cargas" ADD COLUMN "eliminada_por" INTEGER;

-- La pantalla de Inventarios pasa a llamarse Inventario.
UPDATE "modulos" SET "nombre" = 'Inventario' WHERE "ruta" = 'inventarios';
UPDATE "paginas" SET "nombre" = 'Inventario'
WHERE "ruta" = 'cargas' AND "modulo_id" = (SELECT "id" FROM "modulos" WHERE "ruta" = 'inventarios');
