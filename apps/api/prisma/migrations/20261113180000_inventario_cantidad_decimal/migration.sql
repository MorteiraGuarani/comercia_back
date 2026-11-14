-- La cantidad del inventario admite hasta dos decimales (por ejemplo 2,5 kg).
-- Los enteros cargados se conservan tal cual (5 pasa a 5.00).
ALTER TABLE "campo_inventario_cargas" ALTER COLUMN "cantidad" SET DATA TYPE DECIMAL(12,2);
