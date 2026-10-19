import { closeSync, openSync, readSync } from 'node:fs';
import type { TipoImagen } from '../interfaces/tipo-imagen.interface';

const BYTES_CABECERA = 12;

/**
 * Reconoce JPG, PNG y WebP por sus primeros bytes. El tipo MIME y la
 * extensión los elige quien sube el archivo; la firma no.
 */
export function detectarTipoImagen(cabecera: Uint8Array): TipoImagen | null {
  const b = cabecera;
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    return { mime: 'image/jpeg', extension: '.jpg' };
  }
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (b.length >= png.length && png.every((byte, i) => b[i] === byte)) {
    return { mime: 'image/png', extension: '.png' };
  }
  const ascii = (desde: number, hasta: number) =>
    String.fromCharCode(...b.subarray(desde, hasta));
  if (
    b.length >= BYTES_CABECERA &&
    ascii(0, 4) === 'RIFF' &&
    ascii(8, 12) === 'WEBP'
  ) {
    return { mime: 'image/webp', extension: '.webp' };
  }
  return null;
}

/** Primeros bytes de un archivo de Multer, en memoria o en disco. */
export function leerCabeceraArchivo(file: Express.Multer.File): Uint8Array {
  if (file.buffer) return file.buffer.subarray(0, BYTES_CABECERA);
  const cabecera = Buffer.alloc(BYTES_CABECERA);
  const fd = openSync(file.path, 'r');
  try {
    const leidos = readSync(fd, cabecera, 0, BYTES_CABECERA, 0);
    return cabecera.subarray(0, leidos);
  } finally {
    closeSync(fd);
  }
}
