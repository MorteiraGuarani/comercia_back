import { extname } from 'node:path';

const MIME_POR_EXTENSION: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  // Solo logos anteriores: ya no se aceptan SVG nuevos.
  '.svg': 'image/svg+xml',
};

export function tipoContenidoImagen(nombre: string): string {
  return (
    MIME_POR_EXTENSION[extname(nombre).toLowerCase()] ??
    'application/octet-stream'
  );
}
