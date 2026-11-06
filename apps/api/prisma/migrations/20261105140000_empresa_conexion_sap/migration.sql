-- Datos de conexión a SAP por empresa. La contraseña nunca sale por la API.
ALTER TABLE "empresas" ADD COLUMN "sap_esquema" VARCHAR(100),
ADD COLUMN "sap_usuario" VARCHAR(100),
ADD COLUMN "sap_contrasenia" VARCHAR(100);
