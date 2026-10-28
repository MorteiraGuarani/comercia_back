-- Foto de perfil que sube cada usuario desde "Mis datos".
ALTER TABLE "usuarios"
  ADD COLUMN "foto_perfil" VARCHAR(255),
  ADD COLUMN "foto_perfil_mime" VARCHAR(40);
