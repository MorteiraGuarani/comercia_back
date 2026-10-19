"use client";

import { useEffect } from "react";

/**
 * Registra el service worker que permite instalar la app y abrirla sin señal.
 * Solo en producción y en un contexto seguro (HTTPS): por HTTP en la LAN el
 * navegador no lo permite y la app sigue funcionando igual que antes.
 */
export function RegistroServiceWorker() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      !("serviceWorker" in navigator) ||
      !window.isSecureContext
    )
      return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch(() => undefined);
  }, []);
  return null;
}
