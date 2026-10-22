-- Inventario por local: productos (tbl_oitm) de cada cliente (tbl_ocrd), carga
-- diaria de cantidad y vencimiento, y días de aviso configurables por empresa.

-- AlterEnum
ALTER TYPE "TipoNotificacionCampo" ADD VALUE 'VENCIMIENTO_PROXIMO';

-- AlterTable
ALTER TABLE "empresas" ADD COLUMN     "dias_aviso_vencimiento" INTEGER NOT NULL DEFAULT 5;

-- CreateTable
CREATE TABLE "campo_inventario_productos" (
    "empresa_id" INTEGER NOT NULL,
    "CardCode" VARCHAR(50) NOT NULL,
    "ItemCode" VARCHAR(15) NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campo_inventario_productos_pkey" PRIMARY KEY ("empresa_id","CardCode","ItemCode")
);

-- CreateTable
CREATE TABLE "campo_inventario_cargas" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "CardCode" VARCHAR(50) NOT NULL,
    "ItemCode" VARCHAR(15) NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "vencimiento" DATE NOT NULL,
    "avisado_en" TIMESTAMP(3),
    "creada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campo_inventario_cargas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "campo_inventario_cargas_empresa_id_CardCode_fecha_idx" ON "campo_inventario_cargas"("empresa_id", "CardCode", "fecha");

-- CreateIndex
CREATE INDEX "campo_inventario_cargas_avisado_en_vencimiento_idx" ON "campo_inventario_cargas"("avisado_en", "vencimiento");

-- CreateIndex
CREATE UNIQUE INDEX "campo_inventario_cargas_empresa_id_CardCode_ItemCode_fecha_key" ON "campo_inventario_cargas"("empresa_id", "CardCode", "ItemCode", "fecha");

-- AddForeignKey
ALTER TABLE "campo_inventario_productos" ADD CONSTRAINT "campo_inventario_productos_empresa_id_CardCode_fkey" FOREIGN KEY ("empresa_id", "CardCode") REFERENCES "tbl_ocrd"("empresa_id", "CardCode") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campo_inventario_productos" ADD CONSTRAINT "campo_inventario_productos_empresa_id_ItemCode_fkey" FOREIGN KEY ("empresa_id", "ItemCode") REFERENCES "tbl_oitm"("empresa_id", "ItemCode") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campo_inventario_cargas" ADD CONSTRAINT "campo_inventario_cargas_empresa_id_CardCode_fkey" FOREIGN KEY ("empresa_id", "CardCode") REFERENCES "tbl_ocrd"("empresa_id", "CardCode") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campo_inventario_cargas" ADD CONSTRAINT "campo_inventario_cargas_empresa_id_ItemCode_fkey" FOREIGN KEY ("empresa_id", "ItemCode") REFERENCES "tbl_oitm"("empresa_id", "ItemCode") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campo_inventario_cargas" ADD CONSTRAINT "campo_inventario_cargas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

