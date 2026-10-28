import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';
import { randomUUID } from 'node:crypto';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { directorioUploads } from '../../campo/utils/multer-config';

/** Carpeta de las fotos de perfil dentro de UPLOADS_DIR. */
export const CARPETA_FOTOS_PERFIL = 'perfiles';

// El tipo real se valida después con validarArchivoImagen (firma del archivo).
export const multerConfigFotoPerfil: MulterOptions = {
  storage: diskStorage({
    destination: (req, file, cb) => {
      const dir = join(directorioUploads(), CARPETA_FOTOS_PERFIL);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      cb(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
};
