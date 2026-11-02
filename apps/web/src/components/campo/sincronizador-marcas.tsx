"use client";

import { useEffect } from "react";
import { mostrarToast } from "@/components/toast/toast-controller";
import {
  enviarMarcasSinConexion,
  leerMarcasSinConexion,
} from "@/lib/marcas-sin-conexion";

/** Manda las marcas guardadas sin conexión y avisa qué pasó con cada una. */
export async function enviarMarcasYAvisar(usuarioId: number) {
  const { enviadas, rechazadas } = await enviarMarcasSinConexion(usuarioId);
  if (enviadas.length)
    mostrarToast(
      "exito",
      enviadas.length === 1
        ? `La ${enviadas[0].tipo === "ENTRADA" ? "entrada" : "salida"} de ${enviadas[0].local.nombre} guardada sin conexión ya está en Ucheck.`
        : `Las ${enviadas.length} marcas guardadas sin conexión ya están en Ucheck.`,
      "Marcas enviadas",
    );
  for (const { marca, motivo } of rechazadas)
    mostrarToast(
      "error",
      `${marca.tipo === "ENTRADA" ? "Entrada" : "Salida"} de ${marca.local.nombre}: ${motivo}`,
      "Ucheck rechazó una marca guardada sin conexión",
    );
  return { enviadas, rechazadas };
}

/**
 * Entradas y salidas guardadas en el navegador sin conexión con Ucheck: se
 * mandan al montar, al volver la señal o la pestaña, y cada minuto.
 */
export function SincronizadorMarcas({ usuarioId }: { usuarioId: number }) {
  useEffect(() => {
    const enviar = () => {
      if (document.hidden || !navigator.onLine) return;
      if (leerMarcasSinConexion(usuarioId).length)
        void enviarMarcasYAvisar(usuarioId).catch(() => undefined);
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
