-- Número que SAP le asigna a cada documento al crearlo. Admite nulos: no toca las filas existentes.
ALTER TABLE "campo_documento" ADD COLUMN "DocNum" INTEGER;
