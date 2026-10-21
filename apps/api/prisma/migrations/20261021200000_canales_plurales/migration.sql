BEGIN;

-- Cambia el catálogo canónico sin perder los códigos todavía presentes en singular.
LOCK TABLE tbl_ocrd, tbl_jcanal, tbl_jcanales, tbl_jsubcanal, tbl_jsubcanales IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM tbl_jcanal s JOIN tbl_jcanales p USING (empresa_id, "Code")
    WHERE s."Name" IS NOT NULL AND p."Name" IS NOT NULL AND s."Name" IS DISTINCT FROM p."Name"
  ) OR EXISTS (
    SELECT 1 FROM tbl_jsubcanal s JOIN tbl_jsubcanales p USING (empresa_id, "Code")
    WHERE s."Name" IS NOT NULL AND p."Name" IS NOT NULL AND s."Name" IS DISTINCT FROM p."Name"
  ) THEN
    RAISE EXCEPTION 'Canales incompatibles: resolver nombres distintos para la misma empresa/Code antes de retirar las tablas singulares';
  END IF;
END $$;

INSERT INTO tbl_jcanales (empresa_id, "Code", "Name")
SELECT empresa_id, "Code", "Name" FROM tbl_jcanal
ON CONFLICT (empresa_id, "Code") DO UPDATE SET "Name" = COALESCE(tbl_jcanales."Name", EXCLUDED."Name");

INSERT INTO tbl_jsubcanales (empresa_id, "Code", "Name")
SELECT empresa_id, "Code", "Name" FROM tbl_jsubcanal
ON CONFLICT (empresa_id, "Code") DO UPDATE SET "Name" = COALESCE(tbl_jsubcanales."Name", EXCLUDED."Name");

-- Sin CASCADE: una dependencia inesperada debe impedir el DROP.
DROP TABLE tbl_jcanal;
DROP TABLE tbl_jsubcanal;

-- Mantiene válidas también las identidades SQL después de importar Code explícitos.
SELECT setval(pg_get_serial_sequence('tbl_jcanales', 'Code'),
  GREATEST(COALESCE((SELECT max("Code") FROM tbl_jcanales), 0), 1),
  EXISTS(SELECT 1 FROM tbl_jcanales WHERE "Code" >= 1));
SELECT setval(pg_get_serial_sequence('tbl_jsubcanales', 'Code'),
  GREATEST(COALESCE((SELECT max("Code") FROM tbl_jsubcanales), 0), 1),
  EXISTS(SELECT 1 FROM tbl_jsubcanales WHERE "Code" >= 1));

COMMIT;
