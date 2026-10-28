-- Referencias ERP opcionales: los usuarios existentes conservan sus datos.
ALTER TABLE "usuarios"
  ADD COLUMN "ERP_CanalVenta" VARCHAR(50),
  ADD COLUMN "ERP_Almacen" VARCHAR(8),
  ADD COLUMN "ERP_Supervisor" VARCHAR(30),
  ADD COLUMN "ERP_Vendedor" INTEGER,
  ADD COLUMN "ERP_Repositor" VARCHAR(50),
  ADD COLUMN "ERP_Impulsador" VARCHAR(50);
