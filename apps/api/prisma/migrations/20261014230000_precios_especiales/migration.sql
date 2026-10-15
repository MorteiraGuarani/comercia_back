-- Precios especiales (tbl_ospp) y su detalle por vigencia (tbl_spp1), por empresa.
-- Los datos de negocio son opcionales; los únicos con nulos no se consideran duplicados.
-- CreateTable
CREATE TABLE "tbl_ospp" (
    "id" BIGSERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "cardcode" VARCHAR(50),
    "cardname" VARCHAR(200),
    "cardtype" VARCHAR(20),
    "listpricename" VARCHAR(100),
    "listpricecod" INTEGER,
    "itemcode" VARCHAR(50),
    "itemname" VARCHAR(200),
    "price" DECIMAL(21,6) DEFAULT 0,
    "um" VARCHAR(20),
    "itmsgrpcode" INTEGER,
    "itmsgrpnam" VARCHAR(200),
    "valid" CHAR(1) DEFAULT 'Y',
    CONSTRAINT "tbl_ospp_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "tbl_spp1" (
    "id" BIGSERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "itemcode" VARCHAR(50),
    "cardcode" VARCHAR(15),
    "linenum" SMALLINT,
    "price" DECIMAL(21,6),
    "currency" VARCHAR(3),
    "discount" DECIMAL(21,6),
    "listnum" SMALLINT DEFAULT 0,
    "fromdate" TIMESTAMP(6),
    "todate" TIMESTAMP(6),
    CONSTRAINT "tbl_spp1_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE UNIQUE INDEX "uq_tbl_ospp_item_listprice" ON "tbl_ospp"("empresa_id", "itemcode", "listpricecod", "cardcode", "cardtype");
-- CreateIndex
CREATE INDEX "idx_tbl_spp1_itemcode" ON "tbl_spp1"("empresa_id", "itemcode");
-- CreateIndex
CREATE INDEX "idx_tbl_spp1_currency" ON "tbl_spp1"("empresa_id", "currency");
-- CreateIndex
CREATE INDEX "idx_tbl_spp1_validity" ON "tbl_spp1"("empresa_id", "fromdate", "todate");
-- CreateIndex
CREATE UNIQUE INDEX "uq_tbl_spp1" ON "tbl_spp1"("empresa_id", "cardcode", "itemcode", "linenum", "listnum");
-- AddForeignKey
ALTER TABLE "tbl_ospp" ADD CONSTRAINT "tbl_ospp_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "tbl_spp1" ADD CONSTRAINT "tbl_spp1_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
