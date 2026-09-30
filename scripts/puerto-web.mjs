import { createServer } from 'node:net';

function puertoDisponible(puerto) {
  return new Promise((resolver, rechazar) => {
    const servidor = createServer();
    servidor.unref();
    servidor.once('error', (error) => {
      if (['EADDRINUSE', 'EACCES'].includes(error.code)) resolver(false);
      else rechazar(error);
    });
    servidor.listen(puerto, () => servidor.close(() => resolver(true)));
  });
}

export async function elegirPuertoWeb(preferido, reservados, fijado = false, comprobar = puertoDisponible) {
  if (!Number.isInteger(preferido) || preferido < 1 || preferido > 65535)
    throw new Error('COMERCIA_WEB_PORT debe ser un puerto válido entre 1 y 65535.');
  const candidatos = fijado ? [preferido] : [...new Set([preferido, ...Array.from({ length: 9 }, (_, i) => 3002 + i)])];
  for (const puerto of candidatos) {
    if (!reservados.includes(puerto) && await comprobar(puerto)) return puerto;
  }
  throw new Error(fijado
    ? `El puerto web ${preferido} está ocupado o reservado. Elegí otro COMERCIA_WEB_PORT.`
    : 'No hay un puerto web libre entre 3000 y 3010. Configurá COMERCIA_WEB_PORT con otro puerto disponible.');
}
