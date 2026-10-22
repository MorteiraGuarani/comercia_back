import { metrosEntre } from "./distancia";

export interface CoordenadaCampo {
  latitud: number;
  longitud: number;
}

/** Los socios de OCRD sin U_Latitud/U_Longitud no entran en rutas ni distancias. */
export function conUbicacion<
  T extends { latitud: number | null; longitud: number | null },
>(local: T): local is T & CoordenadaCampo {
  return Number.isFinite(local.latitud) && Number.isFinite(local.longitud);
}

export interface ParadaRutaSugerida {
  id: number;
  latitud: number;
  longitud: number;
  entrada: string;
  salida: string;
}

function minutosDeHora(hhmm: string): number {
  const [hora, minuto] = hhmm.split(":").map(Number);
  if (!Number.isFinite(hora) || !Number.isFinite(minuto)) return 8 * 60;
  return hora * 60 + minuto;
}

function minutosEnZona(fecha: Date, zona = "America/Asuncion"): number {
  const partes = new Intl.DateTimeFormat("en-GB", {
    timeZone: zona,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(fecha);
  const hora = Number(partes.find((p) => p.type === "hour")?.value ?? "8");
  const minuto = Number(partes.find((p) => p.type === "minute")?.value ?? "0");
  return hora * 60 + minuto;
}

function minutosDeViaje(metros: number): number {
  return (metros / 1000 / 25) * 60;
}

/** Vecino más cercano con ventana de atención y espera. */
export function ordenarParadasPorRuta(
  origen: CoordenadaCampo,
  paradas: ParadaRutaSugerida[],
  ahora = new Date(),
): ParadaRutaSugerida[] {
  const restantes = paradas.filter(
    (parada) =>
      Number.isFinite(parada.latitud) && Number.isFinite(parada.longitud),
  );
  const orden: ParadaRutaSugerida[] = [];
  let posicion = origen;
  let reloj = minutosEnZona(ahora);

  while (restantes.length) {
    let mejor = 0;
    let mejorPuntaje = Number.POSITIVE_INFINITY;
    for (let i = 0; i < restantes.length; i += 1) {
      const parada = restantes[i];
      const dist = metrosEntre(posicion, parada);
      const llegada = reloj + minutosDeViaje(dist);
      const abre = minutosDeHora(parada.entrada);
      const cierra = minutosDeHora(parada.salida);
      let puntaje = dist;
      if (llegada > cierra) puntaje += 80_000;
      else if (llegada < abre) puntaje += (abre - llegada) * 90;
      if (puntaje < mejorPuntaje) {
        mejorPuntaje = puntaje;
        mejor = i;
      }
    }
    const siguiente = restantes.splice(mejor, 1)[0];
    const dist = metrosEntre(posicion, siguiente);
    reloj =
      Math.max(reloj + minutosDeViaje(dist), minutosDeHora(siguiente.entrada)) +
      20;
    posicion = siguiente;
    orden.push(siguiente);
  }
  return orden;
}

/** Metros en línea recta desde el origen pasando por las paradas en orden. */
export function metrosRecorrido(
  origen: CoordenadaCampo,
  paradas: CoordenadaCampo[],
): number {
  let total = 0;
  let posicion = origen;
  for (const parada of paradas) {
    total += metrosEntre(posicion, parada);
    posicion = parada;
  }
  return total;
}

export function urlGoogleMapsRuta(
  origen: CoordenadaCampo,
  paradas: CoordenadaCampo[],
): string {
  const conCoord = paradas.filter(
    (p) => Number.isFinite(p.latitud) && Number.isFinite(p.longitud),
  );
  if (!conCoord.length) return "";
  const destino = conCoord[conCoord.length - 1];
  const intermedias = conCoord.slice(0, -1).slice(0, 8);
  const params = new URLSearchParams({
    api: "1",
    origin: `${origen.latitud},${origen.longitud}`,
    destination: `${destino.latitud},${destino.longitud}`,
    travelmode: "driving",
    dir_action: "navigate",
  });
  if (intermedias.length) {
    params.set(
      "waypoints",
      intermedias.map((p) => `${p.latitud},${p.longitud}`).join("|"),
    );
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
