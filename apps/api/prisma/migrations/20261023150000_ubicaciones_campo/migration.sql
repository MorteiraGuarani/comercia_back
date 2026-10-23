-- Posiciones que manda el navegador del equipo de campo durante su jornada.
-- La clave primaria es también el índice de consulta (empresa + usuario + día,
-- ordenado por hora) y vuelve idempotente el reenvío de la cola sin señal.
-- Volumen: un punto por minuto como máximo (menos si la persona está quieta);
-- la API borra cada día lo anterior a 90 días usando el índice BRIN por fecha.
CREATE TABLE "campo_ubicaciones" (
    "empresa_id" INTEGER NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "capturada_en" TIMESTAMP(3) NOT NULL,
    "recibida_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "latitud" DOUBLE PRECISION NOT NULL,
    "longitud" DOUBLE PRECISION NOT NULL,
    "precision_metros" REAL NOT NULL,
    "velocidad_mps" REAL,
    "rumbo_grados" REAL,

    CONSTRAINT "campo_ubicaciones_pkey" PRIMARY KEY ("empresa_id","usuario_id","fecha","capturada_en")
);

CREATE INDEX "campo_ubicaciones_fecha_idx" ON "campo_ubicaciones" USING BRIN ("fecha");

ALTER TABLE "campo_ubicaciones" ADD CONSTRAINT "campo_ubicaciones_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "campo_ubicaciones" ADD CONSTRAINT "campo_ubicaciones_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Página Ubicaciones de Gestión de campo: mapa en vivo y recorrido del día.
-- Se asigna desde Administración (Accesos) igual que las demás del módulo.
INSERT INTO paginas(modulo_id, nombre, ruta, orden, activo, updated_at, icono)
SELECT m.id, 'Ubicaciones', 'ubicaciones',
  COALESCE((SELECT max(p.orden) FROM paginas p WHERE p.modulo_id = m.id), 0) + 1,
  true, CURRENT_TIMESTAMP, 'mapa'
FROM modulos m
WHERE m.ruta = 'gestion-campo'
ON CONFLICT (modulo_id, ruta) DO NOTHING;
