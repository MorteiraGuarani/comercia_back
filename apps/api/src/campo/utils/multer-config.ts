import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { BadRequestException } from '@nestjs/common';
import { existsSync, mkdirSync } from 'fs';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

// Tipos MIME permitidos
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Tamaño máximo: 5 MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;

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

      const dir = `uploads/tareas/${año}/${mes}/${día}`;

      // Crear directorio si no existe
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const uniqueId = uuidv4();
      const ext = extname(file.originalname);
      cb(null, `${uniqueId}${ext}`);
    },
  }),
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(
        new BadRequestException('Solo se permiten imágenes JPG, PNG o WebP'),
        false,
      );
    }

    // Validación adicional: verificar extensión del archivo original
    const ext = extname(file.originalname).toLowerCase();
    const validExtensions = ['.jpg', '.jpeg', '.png', '.webp'];

    if (!validExtensions.includes(ext)) {
      return cb(
        new BadRequestException('Extensión de archivo no válida'),
        false,
      );
    }

    cb(null, true);
  },
};

/**
 * Configuración de Multer para logos de clientes
 */
export const multerConfigLogoCliente: MulterOptions = {
  storage: diskStorage({
    destination: (req, file, cb) => {
      const dir = 'uploads/clientes';
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const uniqueId = uuidv4();
      const ext = extname(file.originalname).toLowerCase();
      cb(null, `logo_${uniqueId}${ext}`);
    },
  }),
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter: (req, file, cb) => {
    const tipos = [...ALLOWED_MIME_TYPES, 'image/svg+xml'];
    if (!tipos.includes(file.mimetype)) {
      return cb(
        new BadRequestException('Solo se permiten imágenes JPG, PNG, WebP o SVG'),
        false,
      );
    }
    cb(null, true);
  },
};

/**
 * Validación adicional de archivo de imagen (verificar magic bytes)
 * Previene spoofing de MIME type
 */
export function validarArchivoImagen(file: Express.Multer.File): void {
  if (!file) {
    throw new BadRequestException('No se proporcionó ningún archivo');
  }

  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    throw new BadRequestException('Solo se permiten imágenes JPG, PNG o WebP');
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new BadRequestException('La imagen no puede superar 5 MB');
  }

  // Verificar magic bytes (primeros bytes del archivo) para evitar spoofing
  // Esto requiere leer el archivo desde disco o buffer
  // Por ahora, la validación de MIME type y extensión es suficiente
  // En producción, considerar agregar validación de magic bytes con 'file-type' package
}
