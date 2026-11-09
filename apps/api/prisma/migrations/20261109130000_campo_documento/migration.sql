-- Documentos de SAP de cada pedido, para editarlos y enviarlos después. Solo agrega: no toca filas existentes.
ALTER TABLE "pedidos" ADD COLUMN "operacion_id" VARCHAR(36);
CREATE UNIQUE INDEX "pedidos_operacion_id_key" ON "pedidos"("operacion_id");

CREATE TABLE "campo_documento" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "pedido_id" INTEGER NOT NULL,
    "enviado_sap" BOOLEAN NOT NULL DEFAULT false,
    "DocDate" DATE NOT NULL,
    "DocDueDate" DATE NOT NULL,
    "CardCode" VARCHAR(50) NOT NULL,
    "NumAtCard" VARCHAR(150) NOT NULL DEFAULT '',
    "DocCurrency" VARCHAR(3) NOT NULL,
    "DocRate" DECIMAL(21,6) NOT NULL,
    "Comments" VARCHAR(254) NOT NULL DEFAULT '',
    "JournalMemo" VARCHAR(254) NOT NULL DEFAULT '',
    "Series" INTEGER,
    "U_beas_pers_id" VARCHAR(150) NOT NULL,
    "U_beas_version" VARCHAR(100) NOT NULL DEFAULT '',
    "U_par" VARCHAR(300) NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campo_documento_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "campo_documento_linea" (
    "id" SERIAL NOT NULL,
    "documento_id" INTEGER NOT NULL,
    "LineNum" INTEGER NOT NULL,
    "ItemCode" VARCHAR(100) NOT NULL,
    "Quantity" INTEGER NOT NULL,
    "WarehouseCode" VARCHAR(100) NOT NULL DEFAULT '',

    CONSTRAINT "campo_documento_linea_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "campo_documento_empresa_id_usuario_id_created_at_idx" ON "campo_documento"("empresa_id", "usuario_id", "created_at");
CREATE INDEX "campo_documento_pedido_id_idx" ON "campo_documento"("pedido_id");
CREATE UNIQUE INDEX "campo_documento_linea_documento_id_LineNum_key" ON "campo_documento_linea"("documento_id", "LineNum");

ALTER TABLE "campo_documento" ADD CONSTRAINT "campo_documento_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "campo_documento" ADD CONSTRAINT "campo_documento_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "campo_documento" ADD CONSTRAINT "campo_documento_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "campo_documento_linea" ADD CONSTRAINT "campo_documento_linea_documento_id_fkey" FOREIGN KEY ("documento_id") REFERENCES "campo_documento"("id") ON DELETE CASCADE ON UPDATE CASCADE;
