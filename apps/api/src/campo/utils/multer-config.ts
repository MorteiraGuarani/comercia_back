import { diskStorage } from 'multer';
import { extname, isAbsolute, join, resolve } from 'path';
import { randomUUID } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import {
  detectarTipoImagen,
  leerCabeceraArchivo,
} from '../../common/utils/firma-imagen';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

// Tipos MIME permitidos
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Tamaño máximo: 5 MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export function directorioUploads(): string {
  return process.env.UPLOADS_DIR ?? resolve(process.cwd(), 'uploads');
}

export function resolverRutaFoto(ruta: string): string {
  if (isAbsolute(ruta)) return ruta;
  const relativa = ruta.replace(/^uploads[/\\]/, '');
  const persistida = resolve(directorioUploads(), relativa);
  return existsSync(persistida) ? persistida : resolve(process.cwd(), ruta);
}

function filtroImagen(
  req: Express.Request,
  file: Express.Multer.File,
  cb: (error: Error | null, acceptFile: boolean) => void,
) {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(
      new BadRequestException('Solo se permiten imágenes JPG, PNG o WebP'),
      false,
    );
  }

  const ext = extname(file.originalname).toLowerCase();
  if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
    return cb(new BadRequestException('Extensión de archivo no válida'), false);
  }

  cb(null, true);
}

/** Configuración compartida para fotos opcionales de novedades y avisos. */
export const multerConfigAdjuntosCampo: MulterOptions = {
  storage: diskStorage({
    destination: (req, file, cb) => {
      const now = new Date();
      const dir = join(
        directorioUploads(),
        'adjuntos',
        String(now.getFullYear()),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0'),
      );
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      cb(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`);
    },
  }),
  limits: { fileSize: MAX_FILE_SIZE, files: 5 },
  fileFilter: filtroImagen,
};

/**
 * Configuración de Multer para subida de fotos de tareas
 */
export const multerConfigFotosTareas: MulterOptions = {
  storage: diskStorage({
    destination: (req, file, cb) => {
      const now = new Date();
      const año = now.getFullYear();
      const mes = String(now.getMonth() + 1).padStart(2, '0');
      const día = String(now.getDate()).padStart(2, '0');

      const dir = join(directorioUploads(), 'tareas', String(año), mes, día);

      // Crear directorio si no existe
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const uniqueId = randomUUID();
      const ext = extname(file.originalname);
      cb(null, `${uniqueId}${ext}`);
    },
  }),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: filtroImagen,
};

function descartar(file: Express.Multer.File): void {
  if (!file.path) return;
  try {
    unlinkSync(file.path);
  } catch {
    // Puede haberlo borrado otra limpieza.
  }
}

/**
 * Valida tipo, tamaño y firma (primeros bytes) de una imagen subida. Si la
 * firma no es de JPG, PNG o WebP borra el archivo y rechaza la subida; si
 * coincide pero el navegador informó otro tipo, corrige `mimetype`, que es
 * el que se guarda y se usa al servirla.
 */
export function validarArchivoImagen(file: Express.Multer.File): void {
  if (!file) {
    throw new BadRequestException('No se proporcionó ningún archivo');
  }

  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    descartar(file);
    throw new BadRequestException('Solo se permiten imágenes JPG, PNG o WebP');
  }

  if (file.size > MAX_FILE_SIZE) {
    descartar(file);
    throw new BadRequestException('La imagen no puede superar 5 MB');
  }

  const tipo = detectarTipoImagen(leerCabeceraArchivo(file));
  if (!tipo) {
    descartar(file);
    throw new BadRequestException(
      'El archivo no es una imagen JPG, PNG o WebP válida',
    );
  }
  file.mimetype = tipo.mime;
}
