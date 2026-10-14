"use client";

import { useEffect, useState } from "react";
import { fechaEnZonaIso } from "@/utils/fechas";

// Cambia el estado solo al cambiar el día; no hace consultas periódicas a la API.
export function useFechaCampo() {
  const [fecha, setFecha] = useState(() => fechaEnZonaIso(new Date()));
  useEffect(() => {
    const actualizar = () => setFecha(fechaEnZonaIso(new Date()));
    const reloj = setInterval(actualizar, 60_000);
    window.addEventListener("focus", actualizar);
    document.addEventListener("visibilitychange", actualizar);
    return () => {
      clearInterval(reloj);
      window.removeEventListener("focus", actualizar);
      document.removeEventListener("visibilitychange", actualizar);
    };
  }, []);
  return fecha;
}
