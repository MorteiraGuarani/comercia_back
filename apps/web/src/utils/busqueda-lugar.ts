const NUMERO = "-?\\d{1,3}(?:\\.\\d+)?";

function valida(latitud: number, longitud: number) {
  return Math.abs(latitud) <= 90 && Math.abs(longitud) <= 180
    ? { latitud, longitud }
    : null;
}

const PATRONES = [
  // Link largo de Google Maps con el lugar marcado: ...!3d-25.29!4d-57.63
  new RegExp(`!3d(${NUMERO})!4d(${NUMERO})`),
  // Centro del mapa en el link: .../@-25.29,-57.63,17z
  new RegExp(`@(${NUMERO}),(${NUMERO})`),
  // ?q=-25.29,-57.63 (también ll, query y destination)
  new RegExp(`[?&](?:q|ll|query|destination)=(${NUMERO}),\\s*(${NUMERO})`),
  // Escritas a mano: "-25.29, -57.63"
  new RegExp(`^(${NUMERO})\\s*[,;\\s]\\s*(${NUMERO})$`),
];

/**
 * Coordenadas escritas a mano o dentro de un link largo de Google Maps.
 * Devuelve null si el texto no trae coordenadas.
 */
export function coordenadasDeTexto(
  texto: string,
): { latitud: number; longitud: number } | null {
  const t = texto.trim();
  for (const patron of PATRONES) {
    const m = patron.exec(t);
    if (m) return valida(Number(m[1]), Number(m[2]));
  }
  return null;
}

/** Links cortos (maps.app.goo.gl, goo.gl/maps): no traen las coordenadas en el texto. */
export function esLinkCortoMaps(texto: string): boolean {
  return /(?:maps\.app\.goo\.gl|goo\.gl\/maps)\//i.test(texto);
}
