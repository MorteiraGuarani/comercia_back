import { createReadStream } from 'node:fs';
import type { Response } from 'express';

/**
 * Transmite un archivo del disco con las cabeceras indicadas. Si falla la
 * lectura (por ejemplo, lo borraron entre la comprobación y el envío) responde
 * 404 en vez de dejar la conexión colgada o tumbar el proceso.
 */
export function enviarArchivo(
  res: Response,
  ruta: string,
  cabeceras: Record<string, string>,
): void {
  const stream = createReadStream(ruta);
  stream.once('open', () => {
    for (const [nombre, valor] of Object.entries(cabeceras)) {
      res.setHeader(nombre, valor);
    }
    stream.pipe(res);
  });
  stream.once('error', () => {
    if (res.headersSent) {
      res.destroy();
      return;
    }
    res.status(404).json({ message: 'Archivo no disponible' });
  });
}
