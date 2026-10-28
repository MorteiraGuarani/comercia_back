-- Radio de marcación por local: antes era fijo de 100 m para todos.
ALTER TABLE "tbl_ocrd" ADD COLUMN "U_RadioMetros" INTEGER NOT NULL DEFAULT 200;
