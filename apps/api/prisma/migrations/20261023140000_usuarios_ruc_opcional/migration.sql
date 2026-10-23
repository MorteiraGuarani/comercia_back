-- Alta de usuarios con todos los datos opcionales: el RUC puede faltar
-- (sigue siendo único entre los que lo tienen; NULL no choca).
ALTER TABLE "usuarios" ALTER COLUMN "ruc" DROP NOT NULL;
