"use client";
import { useSyncExternalStore } from "react";

function suscribir(aviso: () => void) {
  window.addEventListener("online", aviso);
  window.addEventListener("offline", aviso);
  return () => {
    window.removeEventListener("online", aviso);
    window.removeEventListener("offline", aviso);
  };
}

// Estado de conexión del navegador; se actualiza al perder o recuperar la red.
export function useEnLinea() {
  return useSyncExternalStore(suscribir, () => navigator.onLine, () => true);
}
