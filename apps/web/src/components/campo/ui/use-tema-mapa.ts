"use client";

import { useEffect, useState } from "react";

export const CAPA_MAPA_CLARA = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const CAPA_MAPA_OSCURA = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

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
