BEGIN;

-- Los locales de campo pasan a ser los socios de negocio de tbl_ocrd (clave
-- empresa_id + CardCode). Se eliminan campo_clientes y campo_locales y, con
-- autorización expresa del usuario, todo lo operativo asociado a los locales
-- anteriores: no hay correspondencia confiable entre esos ids y los CardCode.

-- Notificaciones que apuntan a novedades, tareas o fotos que se borran abajo.
DELETE FROM "campo_notificaciones" WHERE "tipo" <> 'AVISO_RECIBIDO';
-- Respuestas y adjuntos de novedades caen en cascada.
DELETE FROM "campo_novedades";
DELETE FROM "integracion_ucheck_eventos";
-- Comentarios y fotos de tareas caen en cascada.
DELETE FROM "campo_cumplimientos";
DELETE FROM "campo_visitas";
DELETE FROM "campo_backups";
DELETE FROM "campo_horarios";
DELETE FROM "campo_asignaciones";
DELETE FROM "campo_tarea_locales";

-- La página Clientes desaparece: los clientes son los socios de negocio.
DELETE FROM "paginas" p USING "modulos" m
WHERE p."modulo_id" = m."id" AND m."ruta" = 'gestion-campo' AND p."ruta" = 'clientes';

-- DropForeignKey
ALTER TABLE "usuarios" DROP CONSTRAINT "usuarios_local_principal_id_fkey";

-- DropForeignKey
ALTER TABLE "campo_clientes" DROP CONSTRAINT "campo_clientes_empresa_id_fkey";

-- DropForeignKey
ALTER TABLE "campo_locales" DROP CONSTRAINT "campo_locales_empresa_id_fkey";

-- DropForeignKey
ALTER TABLE "campo_locales" DROP CONSTRAINT "campo_locales_cliente_id_empresa_id_fkey";

-- DropForeignKey
ALTER TABLE "campo_horarios" DROP CONSTRAINT "campo_horarios_local_id_fkey";

-- DropForeignKey
ALTER TABLE "campo_asignaciones" DROP CONSTRAINT "campo_asignaciones_local_id_fkey";

-- DropForeignKey
ALTER TABLE "campo_tarea_locales" DROP CONSTRAINT "campo_tarea_locales_local_id_fkey";

-- DropForeignKey
ALTER TABLE "campo_visitas" DROP CONSTRAINT "campo_visitas_local_id_fkey";

-- DropForeignKey
ALTER TABLE "integracion_ucheck_eventos" DROP CONSTRAINT "integracion_ucheck_eventos_local_id_fkey";

-- DropForeignKey
ALTER TABLE "campo_novedades" DROP CONSTRAINT "campo_novedades_local_id_fkey";

-- DropIndex
DROP INDEX "usuarios_local_principal_id_idx";

-- DropIndex
DROP INDEX "campo_horarios_local_id_activo_idx";

-- DropIndex
DROP INDEX "campo_horarios_local_id_destinatario_activo_idx";

-- DropIndex
DROP INDEX "campo_horarios_local_id_equipo_campo_id_activo_idx";

-- DropIndex
DROP INDEX "campo_asignaciones_local_id_activo_idx";

-- DropIndex
DROP INDEX "campo_tarea_locales_local_id_idx";

-- DropIndex
DROP INDEX "campo_visitas_local_id_fecha_idx";

-- DropIndex
DROP INDEX "campo_novedades_local_id_estado_idx";

-- AlterTable
ALTER TABLE "usuarios" DROP COLUMN "local_principal_id",
ADD COLUMN     "local_principal_card_code" VARCHAR(15);

-- AlterTable
ALTER TABLE "campo_horarios" DROP COLUMN "local_id",
ADD COLUMN     "CardCode" VARCHAR(15) NOT NULL,
ADD COLUMN     "empresa_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "campo_asignaciones" DROP COLUMN "local_id",
ADD COLUMN     "CardCode" VARCHAR(15) NOT NULL,
ADD COLUMN     "empresa_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "campo_tarea_locales" DROP CONSTRAINT "campo_tarea_locales_pkey",
DROP COLUMN "local_id",
ADD COLUMN     "CardCode" VARCHAR(15) NOT NULL,
ADD COLUMN     "empresa_id" INTEGER NOT NULL,
ADD CONSTRAINT "campo_tarea_locales_pkey" PRIMARY KEY ("tarea_id", "CardCode");

-- AlterTable
ALTER TABLE "campo_visitas" DROP COLUMN "local_id",
ADD COLUMN     "CardCode" VARCHAR(15) NOT NULL,
ADD COLUMN     "empresa_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "integracion_ucheck_eventos" DROP COLUMN "local_id",
ADD COLUMN     "CardCode" VARCHAR(15) NOT NULL;

-- AlterTable
ALTER TABLE "campo_novedades" DROP COLUMN "local_id",
ADD COLUMN     "CardCode" VARCHAR(15) NOT NULL;

-- DropTable
DROP TABLE "campo_clientes";

-- DropTable
DROP TABLE "campo_locales";

-- CreateIndex
CREATE INDEX "usuarios_local_principal_card_code_idx" ON "usuarios"("local_principal_card_code");

-- CreateIndex
CREATE INDEX "campo_horarios_CardCode_activo_idx" ON "campo_horarios"("CardCode", "activo");

-- CreateIndex
CREATE INDEX "campo_horarios_CardCode_destinatario_activo_idx" ON "campo_horarios"("CardCode", "destinatario", "activo");

-- CreateIndex
CREATE INDEX "campo_horarios_CardCode_equipo_campo_id_activo_idx" ON "campo_horarios"("CardCode", "equipo_campo_id", "activo");

-- CreateIndex
CREATE INDEX "campo_asignaciones_CardCode_activo_idx" ON "campo_asignaciones"("CardCode", "activo");

-- CreateIndex
CREATE INDEX "campo_tarea_locales_CardCode_idx" ON "campo_tarea_locales"("CardCode");

-- CreateIndex
CREATE INDEX "campo_visitas_CardCode_fecha_idx" ON "campo_visitas"("CardCode", "fecha");

-- CreateIndex
CREATE INDEX "campo_novedades_CardCode_estado_idx" ON "campo_novedades"("CardCode", "estado");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_empresa_id_local_principal_card_code_fkey" FOREIGN KEY ("empresa_id", "local_principal_card_code") REFERENCES "tbl_ocrd"("empresa_id", "CardCode") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campo_horarios" ADD CONSTRAINT "campo_horarios_empresa_id_CardCode_fkey" FOREIGN KEY ("empresa_id", "CardCode") REFERENCES "tbl_ocrd"("empresa_id", "CardCode") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campo_asignaciones" ADD CONSTRAINT "campo_asignaciones_empresa_id_CardCode_fkey" FOREIGN KEY ("empresa_id", "CardCode") REFERENCES "tbl_ocrd"("empresa_id", "CardCode") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campo_tarea_locales" ADD CONSTRAINT "campo_tarea_locales_empresa_id_CardCode_fkey" FOREIGN KEY ("empresa_id", "CardCode") REFERENCES "tbl_ocrd"("empresa_id", "CardCode") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campo_visitas" ADD CONSTRAINT "campo_visitas_empresa_id_CardCode_fkey" FOREIGN KEY ("empresa_id", "CardCode") REFERENCES "tbl_ocrd"("empresa_id", "CardCode") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integracion_ucheck_eventos" ADD CONSTRAINT "integracion_ucheck_eventos_empresa_id_CardCode_fkey" FOREIGN KEY ("empresa_id", "CardCode") REFERENCES "tbl_ocrd"("empresa_id", "CardCode") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campo_novedades" ADD CONSTRAINT "campo_novedades_empresa_id_CardCode_fkey" FOREIGN KEY ("empresa_id", "CardCode") REFERENCES "tbl_ocrd"("empresa_id", "CardCode") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
