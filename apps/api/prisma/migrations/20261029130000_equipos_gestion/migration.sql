BEGIN;

-- Roles que supervisan varios equipos (jefe de canal, back office de canal,
-- gerencia) sin ser parte de uno: una lista de equipos o todos los de la empresa.
ALTER TABLE "roles" ADD COLUMN "gestiona_todos_equipos" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "roles" ADD CONSTRAINT "roles_gestion_sin_equipo_check"
  CHECK (NOT "gestiona_todos_equipos" OR "equipo_campo_id" IS NULL);

CREATE TABLE "roles_equipos_gestion" (
  "rol_id" INTEGER NOT NULL,
  "equipo_campo_id" INTEGER NOT NULL,
  "empresa_id" INTEGER NOT NULL,
  CONSTRAINT "roles_equipos_gestion_pkey" PRIMARY KEY ("rol_id", "equipo_campo_id"),
  -- Rol y equipo de la misma empresa: la clave compuesta lo garantiza.
  CONSTRAINT "roles_equipos_gestion_rol_id_empresa_id_fkey" FOREIGN KEY ("rol_id", "empresa_id")
    REFERENCES "roles"("id", "empresa_id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "roles_equipos_gestion_equipo_campo_id_empresa_id_fkey" FOREIGN KEY ("equipo_campo_id", "empresa_id")
    REFERENCES "campo_equipos_operativos"("id", "empresa_id") ON DELETE CASCADE ON UPDATE NO ACTION
);

-- Equipo con el que trabaja ahora quien gestiona varios (null = todos).
ALTER TABLE "usuarios" ADD COLUMN "equipo_gestion_id" INTEGER;
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_equipo_gestion_id_empresa_id_fkey"
  FOREIGN KEY ("equipo_gestion_id", "empresa_id")
  REFERENCES "campo_equipos_operativos"("id", "empresa_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT;
