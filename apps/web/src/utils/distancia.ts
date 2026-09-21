export function formatoDistancia(metros: number): string {
  return metros < 1000
    ? `${Math.round(metros)} m`
    : `${(metros / 1000).toFixed(1)} km`;
}

export function metrosEntre(
  origen: { latitud: number; longitud: number },
  destino: { latitud: number; longitud: number },
): number {
  const aLat = (origen.latitud * Math.PI) / 180;
  const bLat = (destino.latitud * Math.PI) / 180;
  const dLat = bLat - aLat;
  const dLng = ((destino.longitud - origen.longitud) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat) * Math.cos(bLat) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h)));
}
