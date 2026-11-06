-- Registro de cada pedido de marca de campo (aceptado, rechazado o con error)
-- con el pedido y la respuesta completos y quién marcó, para revisarlo desde
-- superadmin. Sin claves foráneas.
CREATE TABLE "campo_registro_marcaciones" (
    "id" SERIAL NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ruta" VARCHAR(160) NOT NULL,
    "tipo" VARCHAR(10) NOT NULL,
    "resultado" VARCHAR(10) NOT NULL,
    "usuario_id" INTEGER,
    "usuario_nombre" VARCHAR(200),
    "usuario_correo" VARCHAR(254),
    "usuario_login" VARCHAR(100),
    "empresa_id" INTEGER,
    "empresa_nombre" VARCHAR(200),
    "estado_http" INTEGER NOT NULL,
    "codigo" VARCHAR(40),
    "motivo" VARCHAR(1000) NOT NULL,
    "duracion_ms" INTEGER NOT NULL,
    "solicitud" JSONB NOT NULL,
    "respuesta" JSONB,

    CONSTRAINT "campo_registro_marcaciones_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "campo_registro_marcaciones_creado_en_idx" ON "campo_registro_marcaciones"("creado_en");
CREATE INDEX "campo_registro_marcaciones_resultado_creado_en_idx" ON "campo_registro_marcaciones"("resultado", "creado_en");
CREATE INDEX "campo_registro_marcaciones_usuario_id_creado_en_idx" ON "campo_registro_marcaciones"("usuario_id", "creado_en");
