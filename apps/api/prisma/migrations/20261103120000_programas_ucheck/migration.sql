-- Copia en Comercia de los programas de Ucheck de cada usuario: el ABM los
-- elige, se mandan a Ucheck y lo que Ucheck confirma vuelve acá.
ALTER TABLE "usuarios" ADD COLUMN "programas_ucheck" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Marca que el cambio pendiente incluye programas (sin ella Ucheck conserva los suyos).
ALTER TABLE "ucheck_usuarios_pendientes" ADD COLUMN "programas" BOOLEAN NOT NULL DEFAULT false;

-- Cuentas ya vinculadas: una sincronización sin programas trae su copia y su
-- usuario único a Ucheck. No crea cuentas nuevas.
INSERT INTO "ucheck_usuarios_pendientes" ("usuario_id")
SELECT "usuario_id" FROM "identidades_ucheck"
ON CONFLICT ("usuario_id") DO NOTHING;
