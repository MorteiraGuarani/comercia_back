-- Las fotos antes/después pueden adjuntarse sin dar la tarea por completada.
-- Las fechas de todos los cumplimientos existentes se conservan.
ALTER TABLE "campo_cumplimientos" ALTER COLUMN "completada_at" DROP NOT NULL;
