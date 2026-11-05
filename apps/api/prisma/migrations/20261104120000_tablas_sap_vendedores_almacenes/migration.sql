-- tbl_oagp: AgentCode obligatorio y largos de SAP. Prod no tiene AgentCode nulo ni de más de 150.
ALTER TABLE "tbl_oagp"
  ALTER COLUMN "AgentCode" SET NOT NULL,
  ALTER COLUMN "AgentCode" TYPE VARCHAR(150),
  ALTER COLUMN "AgentName" TYPE VARCHAR(250),
  ALTER COLUMN "Memo" TYPE VARCHAR(250);

-- tbl_oslp con los campos de SAP Service Layer. La recreación solicitada borra
-- los vendedores cargados: se vuelven a cargar desde SAP.
DROP TABLE "tbl_oslp";
CREATE TABLE "tbl_oslp" (
  "id" BIGSERIAL PRIMARY KEY,
  "empresa_id" INTEGER NOT NULL REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "SalesEmployeeCode" INTEGER NOT NULL,
  "SalesEmployeeName" VARCHAR(150),
  "Remarks" VARCHAR(150),
  "CommissionForSalesEmployee" INTEGER,
  "CommissionGroup" INTEGER,
  "Locked" VARCHAR(3),
  "EmployeeID" INTEGER,
  "Active" VARCHAR(3),
  "Telephone" VARCHAR(100),
  "Mobile" VARCHAR(100),
  "Fax" VARCHAR(100),
  "Email" VARCHAR(200)
);
CREATE UNIQUE INDEX "uq_tbl_oslp_empresa_clave" ON "tbl_oslp" ("empresa_id", "SalesEmployeeCode");
CREATE INDEX "idx_tbl_oslp_salesemployeename" ON "tbl_oslp" ("empresa_id", "SalesEmployeeName");

CREATE TABLE "tbl_owhs" (
  "id" BIGSERIAL PRIMARY KEY,
  "empresa_id" INTEGER NOT NULL REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "WarehouseCode" VARCHAR(100) NOT NULL,
  "WarehouseName" VARCHAR(300),
  "Location" INTEGER,
  "GlobalLocationNumber" VARCHAR(100)
);
CREATE UNIQUE INDEX "uq_tbl_owhs_empresa_clave" ON "tbl_owhs" ("empresa_id", "WarehouseCode");

CREATE TABLE "tbl_oclp" (
  "id" BIGSERIAL PRIMARY KEY,
  "empresa_id" INTEGER NOT NULL REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "Code" INTEGER NOT NULL,
  "Name" VARCHAR(100)
);
CREATE UNIQUE INDEX "uq_tbl_oclp_empresa_clave" ON "tbl_oclp" ("empresa_id", "Code");

CREATE TABLE "tbl_jfdv" (
  "id" BIGSERIAL PRIMARY KEY,
  "empresa_id" INTEGER NOT NULL REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "Code" VARCHAR(20) NOT NULL,
  "Name" VARCHAR(150),
  "U_ESACALA" VARCHAR(100),
  "U_TIPO" VARCHAR(100),
  "U_ACTIVO" VARCHAR(100)
);
CREATE UNIQUE INDEX "uq_tbl_jfdv_empresa_clave" ON "tbl_jfdv" ("empresa_id", "Code");
