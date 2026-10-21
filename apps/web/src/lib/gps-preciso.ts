// La primera lectura del GPS en un celular suele venir del Wi-Fi o de la
// antena y tener cientos de metros de error. Se escucha unos segundos y se
// usa la lectura más precisa.

export class ErrorGps extends Error {
  constructor(
    message: string,
    /** Código de GeolocationPositionError (1 permiso, 2 sin señal, 3 tiempo). */
    public readonly codigo: number,
  ) {
    super(message);
  }
}

const MENSAJES: Record<number, string> = {
  1: "Permiso de ubicación denegado en el navegador.",
  2: "La ubicación no está disponible. Activá el GPS y reintentá.",
  3: "El GPS tardó demasiado en responder. Reintentá al aire libre.",
};

export function obtenerPosicionPrecisa({
  objetivoMetros = 15,
  maxMs = 10_000,
  alMejorar,
}: {
  /** Precisión con la que se deja de esperar. */
  objetivoMetros?: number;
  /** Tiempo máximo de escucha; se devuelve la mejor lectura hasta ahí. */
  maxMs?: number;
  /** Cada lectura que mejora la anterior (para ir mostrando el avance). */
  alMejorar?: (posicion: GeolocationPosition) => void;
} = {}): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      reject(new ErrorGps("Este dispositivo no tiene GPS disponible.", 2));
      return;
    }
    let mejor: GeolocationPosition | null = null;
    let terminado = false;
    const terminar = (error?: ErrorGps) => {
      if (terminado) return;
      terminado = true;
      navigator.geolocation.clearWatch(vigilancia);
      clearTimeout(limite);
      if (mejor) resolve(mejor);
      else reject(error ?? new ErrorGps(MENSAJES[3], 3));
    };
    const vigilancia = navigator.geolocation.watchPosition(
      (posicion) => {
        if (!mejor || posicion.coords.accuracy < mejor.coords.accuracy) {
          mejor = posicion;
          alMejorar?.(posicion);
        }
        if (posicion.coords.accuracy <= objetivoMetros) terminar();
      },
      (error) => {
        // Sin ninguna lectura no hay nada que devolver; con alguna, alcanza.
        terminar(new ErrorGps(MENSAJES[error.code] ?? error.message, error.code));
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: maxMs },
    );
    const limite = setTimeout(() => terminar(), maxMs);
  });
}
