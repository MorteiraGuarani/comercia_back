BEGIN;
CREATE TABLE "productos" (
  "empresa_id" INTEGER NOT NULL,
  "cardcode" VARCHAR(50) NOT NULL,
  "descripcion" VARCHAR(200) NOT NULL,
  "iva" INTEGER NOT NULL CHECK ("iva" BETWEEN 0 AND 100),
  "grupo" INTEGER NOT NULL CHECK ("grupo" >= 0),
  "nombre_grupo" VARCHAR(200) NOT NULL,
  "inventario" BOOLEAN NOT NULL,
  "tipo" VARCHAR(100) NOT NULL,
  CONSTRAINT "productos_pkey" PRIMARY KEY ("empresa_id", "cardcode"),
  CONSTRAINT "productos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "productos_empresa_id_descripcion_idx" ON "productos"("empresa_id", "descripcion");
CREATE TABLE "precios" (
  "id" SERIAL PRIMARY KEY,
  "empresa_id" INTEGER NOT NULL,
  "cardcode" VARCHAR(50) NOT NULL,
  "nro_lista_precio" INTEGER NOT NULL CHECK ("nro_lista_precio" >= 0),
  "lista_precio" VARCHAR(200) NOT NULL,
  "precio" DECIMAL(21,6) NOT NULL CHECK ("precio" >= 0),
  CONSTRAINT "precios_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "precios_empresa_id_cardcode_fkey" FOREIGN KEY ("empresa_id", "cardcode") REFERENCES "productos"("empresa_id", "cardcode") ON DELETE CASCADE ON UPDATE CASCADE
);
-- Cada precio tiene identidad propia; producto y lista pueden repetirse.
CREATE INDEX "precios_empresa_id_cardcode_nro_lista_precio_idx" ON "precios"("empresa_id", "cardcode", "nro_lista_precio");
DELETE FROM "paginas" USING "modulos"
WHERE "paginas"."modulo_id" = "modulos"."id"
  AND "modulos"."ruta" = 'gestion-campo' AND "paginas"."ruta" = 'seguimiento';
UPDATE "roles" SET "puede_ver_seguimiento" = FALSE WHERE "puede_ver_seguimiento";
COMMIT;
