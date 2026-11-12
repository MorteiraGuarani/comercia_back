-- Pedido del usuario: tbl_oitm pasa a los nombres de campo del Service Layer
-- de SAP. La tabla ya está vacía (20261112120000) y nadie la referencia por
-- clave foránea, así que se recrea en vez de renombrar columna por columna.
DROP TABLE "tbl_oitm";
CREATE TABLE "tbl_oitm" (
    "ItemCode"         VARCHAR(100) NOT NULL,
    "ItemName"         VARCHAR(250),
    "ArTaxCode"        VARCHAR(20),
    "ItemsGroupCode"   NUMERIC(19,6),
    "Properties3"      VARCHAR(4),
    "SalesUnitWeight"  NUMERIC(19,6),
    "DefaultWarehouse" VARCHAR(20),
    "Valid"            VARCHAR(4),
    "Frozen"           VARCHAR(4),
    "U_ItemQty"        NUMERIC(19,6),
    "U_beas_vg"        VARCHAR(50),

    CONSTRAINT "pk_tbl_oitm" PRIMARY KEY ("ItemCode")
);
