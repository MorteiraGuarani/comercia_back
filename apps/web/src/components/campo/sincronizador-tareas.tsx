"use client";

import { useEffect } from "react";
import { listarPendientes, sincronizarPendientes } from "@/lib/pendientes-tareas";

/**
 * Envía las acciones de tareas guardadas sin señal (finalizar, fotos,
 * comentarios) aunque no se abra ninguna pantalla de tareas: al montar, al
 * volver la señal o la app, y cada minuto. Solo consulta la API si hay algo.
 */
export function SincronizadorTareas({ usuarioId }: { usuarioId: number }) {
  useEffect(() => {
    const enviar = () => {
      if (document.hidden || !navigator.onLine) return;
      void listarPendientes(usuarioId)
        .then((acciones) =>
          acciones.some((a) => a.estado === "PENDIENTE")
            ? sincronizarPendientes(usuarioId)
            : undefined,
        )
        .catch(() => undefined);
    };
    enviar();
    const intervalo = setInterval(enviar, 60_000);
    window.addEventListener("online", enviar);
    document.addEventListener("visibilitychange", enviar);
    return () => {
      clearInterval(intervalo);
      window.removeEventListener("online", enviar);
      document.removeEventListener("visibilitychange", enviar);
    };
  }, [usuarioId]);
  return null;
}
