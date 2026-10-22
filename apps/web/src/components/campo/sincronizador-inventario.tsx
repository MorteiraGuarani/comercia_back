"use client";

import { useEffect } from "react";

const PANTALLA_INVENTARIO = "/panel/mi-jornada/inventario";

/**
 * Mantiene el inventario guardado en el equipo aunque no se abra la pantalla:
 * envía lo pendiente y descarga en la primera conexión del día y desde el
 * mediodía. Revisa al montar, al volver la señal o la app, y cada minuto.
 */
export function SincronizadorInventario({ usuarioId }: { usuarioId: number }) {
  useEffect(() => {
    let vigente = true;
    const sincronizar = () => {
      if (document.hidden || !navigator.onLine) return;
      // Dexie y la pantalla se cargan solo para quien tiene Inventario; así
      // además quedan guardados para abrir sin señal.
      void import("@/lib/inventario-db")
        .then(async ({ sincronizarInventario }) => {
          if (vigente) await sincronizarInventario(usuarioId);
        })
        .catch(() => undefined);
    };
    sincronizar();
    void import("./inventario-panel").catch(() => undefined);
    navigator.serviceWorker?.controller?.postMessage({
      tipo: "guardar-pantallas",
      rutas: [PANTALLA_INVENTARIO],
    });
    const intervalo = setInterval(sincronizar, 60_000);
    window.addEventListener("online", sincronizar);
    document.addEventListener("visibilitychange", sincronizar);
    return () => {
      vigente = false;
      clearInterval(intervalo);
      window.removeEventListener("online", sincronizar);
      document.removeEventListener("visibilitychange", sincronizar);
    };
  }, [usuarioId]);
  return null;
}
