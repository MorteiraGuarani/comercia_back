import type { ResultadoLugar } from "@/types/mapa";

interface LugarNominatim {
  name?: string;
  display_name: string;
  lat: string;
  lon: string;
}

/**
 * Busca lugares en OpenStreetMap (Nominatim): gratis y sin clave, con uso
 * razonable (una búsqueda por pedido del usuario, no mientras escribe).
 * `cerca` da prioridad a lo que está alrededor del mapa visible.
 */
export async function buscarLugares(
  texto: string,
  {
    cerca,
    signal,
  }: { cerca?: { latitud: number; longitud: number }; signal?: AbortSignal } = {},
): Promise<ResultadoLugar[]> {
  const parametros = new URLSearchParams({
    q: texto,
    format: "jsonv2",
    limit: "6",
    "accept-language": "es",
  });
  if (cerca) {
    const d = 0.6;
    parametros.set(
      "viewbox",
      [cerca.longitud - d, cerca.latitud + d, cerca.longitud + d, cerca.latitud - d].join(","),
    );
  }
  const respuesta = await fetch(
    `https://nominatim.openstreetmap.org/search?${parametros}`,
    { signal, headers: { Accept: "application/json" } },
  );
  if (!respuesta.ok)
    throw new Error("El buscador de lugares no respondió. Probá de nuevo.");
  const lugares = (await respuesta.json()) as LugarNominatim[];
  return lugares.map((l) => {
    const partes = l.display_name.split(", ");
    const nombre = l.name || partes[0];
    return {
      nombre,
      detalle: partes.slice(1, 5).join(", "),
      latitud: Number(l.lat),
      longitud: Number(l.lon),
    };
  });
}
