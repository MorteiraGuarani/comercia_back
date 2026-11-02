-- Alta, edición y baja de usuarios que falta llevar a Ucheck desde el ABM.
-- Una fila por usuario; se borra cuando Ucheck toma su estado actual.
CREATE TABLE "ucheck_usuarios_pendientes" (
    "usuario_id" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "ucheck_usuario_id" INTEGER,
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "siguiente_intento" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimo_error" VARCHAR(500),

    CONSTRAINT "ucheck_usuarios_pendientes_pkey" PRIMARY KEY ("usuario_id")
);

CREATE INDEX "ucheck_usuarios_pendientes_siguiente_intento_idx" ON "ucheck_usuarios_pendientes"("siguiente_intento");

ALTER TABLE "ucheck_usuarios_pendientes" ADD CONSTRAINT "ucheck_usuarios_pendientes_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
