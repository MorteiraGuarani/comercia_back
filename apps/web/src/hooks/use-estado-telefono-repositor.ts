"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import type { EstadoTelefonoRepositor } from "@/types/seguimiento";

export function useEstadoTelefonoRepositor() {
  const [estado, setEstado] = useState<EstadoTelefonoRepositor | null>(null);
  const [actualizando, setActualizando] = useState(false);
  const [comprobadoEn, setComprobadoEn] = useState<string | null>(null);
  const vigente = useRef(false);
  const solicitudActual = useRef<AbortController | null>(null);
  const manualEnCurso = useRef(false);

  const consultar = useCallback(async (manual = false) => {
    if (!vigente.current) return;
    if (!manual && (manualEnCurso.current || document.hidden || solicitudActual.current)) return;

    const controlador = new AbortController();
    solicitudActual.current = controlador;
    const limite = setTimeout(() => controlador.abort(), 15_000);
    try {
      const respuesta = await apiFetch<EstadoTelefonoRepositor>(
        "/campo/jornada/repositor/telefono",
        { signal: controlador.signal },
      );
      if (!vigente.current || solicitudActual.current !== controlador) return;
      if (!respuesta?.estado || !respuesta.mensaje)
        throw new Error("Respuesta de UCheck no disponible");
      setEstado(respuesta);
      setComprobadoEn(new Date().toISOString());
    } catch (error) {
      if (!vigente.current || solicitudActual.current !== controlador) return;
      setEstado({
        estado: error instanceof ApiError && error.status === 403
          ? "NO_HABILITADO" : "SIN_CONEXION",
        mensaje: error instanceof ApiError && error.status === 401
          ? "Tu sesión venció. Volvé a ingresar en Comercia."
          : error instanceof ApiError && error.status === 403
            ? "No tenés permiso para consultar el teléfono. Pedí a un administrador que revise tu acceso."
            : controlador.signal.aborted
              ? "La consulta a UCheck tardó demasiado. Volvé a comprobar el teléfono."
              : "No se pudo consultar el teléfono. Revisá tu conexión y volvé a comprobar UCheck.",
      });
      setComprobadoEn(new Date().toISOString());
    } finally {
      clearTimeout(limite);
      // Una consulta cancelada no debe finalizar ni sobrescribir la nueva.
      if (solicitudActual.current === controlador) {
        solicitudActual.current = null;
        manualEnCurso.current = false;
        if (vigente.current && manual) setActualizando(false);
      }
    }
  }, []);

  useEffect(() => {
    vigente.current = true;
    queueMicrotask(() => void consultar());
    // Con la pestaña oculta no consulta UCheck; al volver, actualiza enseguida.
    const siVisible = () => {
      if (!document.hidden) void consultar();
    };
    const timer = setInterval(siVisible, 15_000);
    document.addEventListener("visibilitychange", siVisible);
    return () => {
      document.removeEventListener("visibilitychange", siVisible);
      vigente.current = false;
      solicitudActual.current?.abort();
      solicitudActual.current = null;
      manualEnCurso.current = false;
      clearInterval(timer);
    };
  }, [consultar]);

  const comprobar = useCallback(() => {
    if (!vigente.current || manualEnCurso.current) return;
    manualEnCurso.current = true;
    setActualizando(true);
    solicitudActual.current?.abort();
    void consultar(true);
  }, [consultar]);
  return { estado, actualizando, comprobadoEn, comprobar };
}
