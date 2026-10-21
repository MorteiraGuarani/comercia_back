"use client";

import { useEffect, useState } from "react";

export const CAPA_MAPA = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
// CARTO ahora pide clave de API ("API KEY REQUIRED" en cada cuadro). En modo
// oscuro se usa el mismo mapa de OpenStreetMap con un filtro (globals.css).
export const CLASE_CAPA_OSCURA = "capa-mapa-oscura";

export function useTemaOscuroMapa() {
  const [oscuro, setOscuro] = useState(false);

  useEffect(() => {
    const sincronizar = () => {
      setOscuro(document.documentElement.classList.contains("dark"));
    };

    sincronizar();
    const observador = new MutationObserver(sincronizar);
    observador.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observador.disconnect();
  }, []);

  return oscuro;
}
