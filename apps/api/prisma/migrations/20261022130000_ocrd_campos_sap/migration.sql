BEGIN;

-- Estructura actualizada de OCRD (SAP) sin DROP: tbl_ocrd es la clave de la
-- operación de campo (FK por empresa_id + CardCode) y conserva sus filas.
-- CardCode pasa a 50 caracteres también en las tablas que lo referencian.

-- DropForeignKey
ALTER TABLE "usuarios" DROP CONSTRAINT "usuarios_empresa_id_local_principal_card_code_fkey";

-- DropForeignKey
ALTER TABLE "campo_horarios" DROP CONSTRAINT "campo_horarios_empresa_id_CardCode_fkey";

-- DropForeignKey
ALTER TABLE "campo_asignaciones" DROP CONSTRAINT "campo_asignaciones_empresa_id_CardCode_fkey";

-- DropForeignKey
ALTER TABLE "campo_tarea_locales" DROP CONSTRAINT "campo_tarea_locales_empresa_id_CardCode_fkey";

-- DropForeignKey
ALTER TABLE "campo_visitas" DROP CONSTRAINT "campo_visitas_empresa_id_CardCode_fkey";

-- DropForeignKey
ALTER TABLE "integracion_ucheck_eventos" DROP CONSTRAINT "integracion_ucheck_eventos_empresa_id_CardCode_fkey";

-- DropForeignKey
ALTER TABLE "campo_novedades" DROP CONSTRAINT "campo_novedades_empresa_id_CardCode_fkey";

-- AlterTable
ALTER TABLE "tbl_ocrd" ADD COLUMN     "CardFName" VARCHAR(250),
ADD COLUMN     "CardType" VARCHAR(1) DEFAULT 'C',
ADD COLUMN     "Cellular" VARCHAR(50),
ADD COLUMN     "Currency" VARCHAR(4),
ADD COLUMN     "E_Mail" VARCHAR(250),
ADD COLUMN     "GlblLocNum" VARCHAR(50),
ADD COLUMN     "U_Repositor" VARCHAR(50),
ADD COLUMN     "U_SubCanal" VARCHAR(50),
ADD COLUMN     "frozenFor" VARCHAR(1) NOT NULL DEFAULT 'N',
ADD COLUMN     "validFor" VARCHAR(1) NOT NULL DEFAULT 'Y',
ALTER COLUMN "CardCode" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "CardName" SET DATA TYPE VARCHAR(250),
ALTER COLUMN "Phone1" SET DATA TYPE VARCHAR(50);

-- AlterTable
ALTER TABLE "usuarios" ALTER COLUMN "local_principal_card_code" SET DATA TYPE VARCHAR(50);

-- AlterTable
ALTER TABLE "campo_horarios" ALTER COLUMN "CardCode" SET DATA TYPE VARCHAR(50);

-- AlterTable
ALTER TABLE "campo_asignaciones" ALTER COLUMN "CardCode" SET DATA TYPE VARCHAR(50);

-- AlterTable
ALTER TABLE "campo_tarea_locales" DROP CONSTRAINT "campo_tarea_locales_pkey",
ALTER COLUMN "CardCode" SET DATA TYPE VARCHAR(50),
ADD CONSTRAINT "campo_tarea_locales_pkey" PRIMARY KEY ("tarea_id", "CardCode");

-- AlterTable
ALTER TABLE "campo_visitas" ALTER COLUMN "CardCode" SET DATA TYPE VARCHAR(50);

-- AlterTable
ALTER TABLE "integracion_ucheck_eventos" ALTER COLUMN "CardCode" SET DATA TYPE VARCHAR(50);

-- AlterTable
ALTER TABLE "campo_novedades" ALTER COLUMN "CardCode" SET DATA TYPE VARCHAR(50);

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
