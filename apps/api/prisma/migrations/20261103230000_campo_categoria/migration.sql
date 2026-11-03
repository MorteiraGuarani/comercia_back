-- Categorías (líneas) de productos de Pedidos, por empresa.
CREATE TABLE "campo_categoria" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "nombre_categoria" VARCHAR(100) NOT NULL,
    "codesap" INTEGER,
    "Modo" CHAR(1),
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "campo_categoria_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "campo_categoria_empresa_id_orden_idx" ON "campo_categoria"("empresa_id", "orden");

ALTER TABLE "campo_categoria" ADD CONSTRAINT "campo_categoria_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
