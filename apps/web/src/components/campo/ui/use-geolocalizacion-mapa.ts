"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type EstadoGpsMapa = "idle" | "loading" | "live" | "error";

export interface PosicionGpsMapa {
  latitud: number;
  longitud: number;
  precision: number;
}

export function useGeolocalizacionMapa() {
  const [posicion, setPosicion] = useState<PosicionGpsMapa | null>(null);
  const [estado, setEstado] = useState<EstadoGpsMapa>("idle");
  const watchRef = useRef<number | null>(null);

  const detener = useCallback(() => {
    if (watchRef.current != null && "geolocation" in navigator) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
  }, []);

  const aplicar = useCallback((coords: GeolocationCoordinates) => {
    setPosicion({
      latitud: coords.latitude,
      longitud: coords.longitude,
      precision: coords.accuracy,
    });
    setEstado("live");
  }, []);

  const iniciar = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setEstado("error");
      return;
    }
    setEstado("loading");
    navigator.geolocation.getCurrentPosition(
      (actual) => {
        aplicar(actual.coords);
        if (watchRef.current == null) {
          watchRef.current = navigator.geolocation.watchPosition(
            (siguiente) => aplicar(siguiente.coords),
            () => undefined,
            { enableHighAccuracy: true, maximumAge: 4000 },
          );
        }
      },
      () => setEstado("error"),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  }, [aplicar]);

  useEffect(() => detener, [detener]);

  return { posicion, estado, iniciar, detener };
}
