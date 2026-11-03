-- Pedidos de preventa cargados en Comercia (todavía sin envío a SAP).
CREATE TYPE "EstadoPedido" AS ENUM ('CARGADO', 'MIGRADO', 'FACTURADO', 'ENTREGADO');

CREATE TABLE "pedidos" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "CardCode" VARCHAR(50) NOT NULL,
    "cliente_nombre" VARCHAR(250) NOT NULL,
    "lista_precios" INTEGER,
    "condicion_pago" INTEGER,
    "fecha_entrega" DATE NOT NULL,
    "observaciones" VARCHAR(500) NOT NULL DEFAULT '',
    "estado" "EstadoPedido" NOT NULL DEFAULT 'CARGADO',
    "total" DECIMAL(21,6) NOT NULL,
    "doc_num_sap" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pedidos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pedido_lineas" (
    "id" SERIAL NOT NULL,
    "pedido_id" INTEGER NOT NULL,
    "ItemCode" VARCHAR(100) NOT NULL,
    "nombre" VARCHAR(200) NOT NULL,
    "linea" VARCHAR(20) NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precio" DECIMAL(21,6),
    "total" DECIMAL(21,6),

    CONSTRAINT "pedido_lineas_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "pedidos_empresa_id_usuario_id_created_at_idx" ON "pedidos"("empresa_id", "usuario_id", "created_at");
CREATE UNIQUE INDEX "pedido_lineas_pedido_id_ItemCode_key" ON "pedido_lineas"("pedido_id", "ItemCode");

ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pedido_lineas" ADD CONSTRAINT "pedido_lineas_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
