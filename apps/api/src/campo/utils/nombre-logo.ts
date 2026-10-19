const PATRON_LOGO =
  /^logo_(?:(\d+)_)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:png|jpe?g|webp|svg)$/;

const EXTENSION_POR_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

export function extensionLogo(mime: string): string {
  return EXTENSION_POR_MIME[mime] ?? '.jpg';
}

/**
 * Interpreta el nombre de archivo de un logo: `logo_<empresa>_<uuid>.<ext>`,
 * o `logo_<uuid>.<ext>` en los anteriores (empresaId null). Cualquier otro
 * nombre, incluidos los que intentan salir de la carpeta, devuelve null.
 */
export function leerNombreLogo(
  archivo: string,
): { nombre: string; empresaId: number | null } | null {
  const coincidencia = PATRON_LOGO.exec(archivo);
  if (!coincidencia) return null;
  return {
    nombre: archivo,
    empresaId: coincidencia[1] ? Number(coincidencia[1]) : null,
  };
}
