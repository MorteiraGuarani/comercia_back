-- Log de auditoría del backoffice: quién (nombre y rol copiados al momento),
-- qué acción, sobre qué entidad y empresa, y el antes/después de lo que cambió.
-- Sin claves foráneas. Nunca guarda contraseñas, hashes, tokens ni credenciales.
CREATE TABLE "auditoria" (
    "id" SERIAL NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuario_id" INTEGER,
    "usuario_nombre" VARCHAR(200),
    "usuario_rol" VARCHAR(120),
    "accion" VARCHAR(10) NOT NULL,
    "entidad" VARCHAR(40) NOT NULL,
    "entidad_id" VARCHAR(80) NOT NULL,
    "etiqueta" VARCHAR(200),
    "empresa_id" INTEGER,
    "cambios" JSONB NOT NULL,

    CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "auditoria_creado_en_idx" ON "auditoria"("creado_en");
CREATE INDEX "auditoria_empresa_id_creado_en_idx" ON "auditoria"("empresa_id", "creado_en");
CREATE INDEX "auditoria_usuario_id_creado_en_idx" ON "auditoria"("usuario_id", "creado_en");
CREATE INDEX "auditoria_entidad_entidad_id_idx" ON "auditoria"("entidad", "entidad_id");
