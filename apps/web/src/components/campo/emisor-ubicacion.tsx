"use client";

import { useEffect } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { EVENTO_JORNADA_MARCADA } from "@/lib/eventos-plataforma";
import type { EstadoUbicacion } from "@/types/ubicacion";
import { debeGuardarPing } from "@/utils/ubicacion";

const CHEQUEO_INACTIVA_MS = 5 * 60_000;
const CLAVE_ACTIVA = "ubicacion-activa";

type Bateria = { level: number; charging: boolean };

const hoy = () => new Date().toLocaleDateString("en-CA");

// Recordar la última respuesta del día deja seguir registrando si la app se
// vuelve a abrir sin señal en medio de la jornada.
function leerActiva(usuarioId: number) {
  try {
    return localStorage.getItem(CLAVE_ACTIVA) === `${usuarioId}|${hoy()}`;
  } catch {
    return false;
  }
}
function guardarActiva(usuarioId: number, activa: boolean) {
  try {
    if (activa) localStorage.setItem(CLAVE_ACTIVA, `${usuarioId}|${hoy()}`);
    else localStorage.removeItem(CLAVE_ACTIVA);
  } catch {
    // Sin almacenamiento solo se pierde el arranque sin señal.
  }
}

async function permisoConcedido() {
  try {
    const p = await navigator.permissions?.query({ name: "geolocation" });
    return !p || p.state === "granted";
  } catch {
    return true;
  }
}

async function bateriaBaja() {
  const nav = navigator as Navigator & { getBattery?: () => Promise<Bateria> };
  const b = await nav.getBattery?.().catch(() => null);
  return !!b && !b.charging && b.level < 0.2;
}

function posicion(precisa: boolean) {
  return new Promise<GeolocationPosition>((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: precisa,
      maximumAge: 30_000,
      timeout: 20_000,
    }),
  );
}

/**
 * Manda la posición mientras la app está abierta y la jornada activa (lo
 * decide la API: desde cada entrada hasta un rato después de la salida). Sin
 * señal guarda los puntos en el equipo y los reenvía al volver. Solo usa el
 * GPS con el permiso ya concedido: nunca abre el aviso del navegador.
 */
export function EmisorUbicacion({ usuarioId }: { usuarioId: number }) {
  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    let vigente = true;
    let activa = leerActiva(usuarioId);
    let intervaloMs = 60_000;
    let ultimoChequeo = 0;
    let ultimo: { latitud: number; longitud: number; momento: number } | null = null;
    let ocupado = false;
    let ahorro = false;
    let temporizador: ReturnType<typeof setTimeout> | undefined;
    const cola = import("@/lib/ubicaciones-db");

    const ciclo = async () => {
      if (!vigente || ocupado || document.hidden) return;
      ocupado = true;
      try {
        if (!(await permisoConcedido())) return;
        if (!activa) {
          if (!navigator.onLine || Date.now() - ultimoChequeo < CHEQUEO_INACTIVA_MS) return;
          ultimoChequeo = Date.now();
          const estado = await apiFetch<EstadoUbicacion>("/campo/ubicaciones/estado");
          intervaloMs = estado.intervaloSegundos * 1000;
          activa = estado.activa;
          guardarActiva(usuarioId, activa);
          if (!activa) return;
        }
        ahorro = await bateriaBaja();
        const p = await posicion(!ahorro);
        const punto = {
          latitud: p.coords.latitude,
          longitud: p.coords.longitude,
          momento: p.timestamp,
        };
        const { encolarPing, enviarPings } = await cola;
        if (debeGuardarPing(ultimo, punto)) {
          await encolarPing({
            usuarioId,
            latitud: punto.latitud,
            longitud: punto.longitud,
            precisionMetros: p.coords.accuracy,
            velocidadMps: Number.isFinite(p.coords.speed) ? p.coords.speed : null,
            rumboGrados: Number.isFinite(p.coords.heading) ? p.coords.heading : null,
            capturadaEn: new Date(p.timestamp).toISOString(),
          });
          ultimo = punto;
        }
        if (navigator.onLine && (await enviarPings(usuarioId)) === false) {
          activa = false;
          guardarActiva(usuarioId, false);
        }
      } catch (error) {
        // Sin acceso a Mi jornada (un supervisor) o permiso denegado: no insistir.
        const permisoGps = !(error instanceof ApiError) && (error as { code?: number })?.code === 1;
        if (permisoGps || (error instanceof ApiError && [401, 403].includes(error.status)))
          vigente = false;
      } finally {
        ocupado = false;
      }
    };

    const programar = () => {
      temporizador = setTimeout(async () => {
        await ciclo();
        if (vigente) programar();
        // Con batería baja se espacian las lecturas y se apaga el GPS preciso.
      }, intervaloMs * (ahorro ? 3 : 1));
    };
    const reenviar = () => {
      if (!navigator.onLine) return;
      void cola.then(({ enviarPings }) => enviarPings(usuarioId)).catch(() => undefined);
    };
    const alMarcar = () => {
      ultimoChequeo = 0;
      activa = false;
      void ciclo();
    };
    const alVolver = () => {
      if (!document.hidden) void ciclo();
    };

    void ciclo();
    programar();
    window.addEventListener("online", reenviar);
    window.addEventListener(EVENTO_JORNADA_MARCADA, alMarcar);
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      vigente = false;
      clearTimeout(temporizador);
      window.removeEventListener("online", reenviar);
      window.removeEventListener(EVENTO_JORNADA_MARCADA, alMarcar);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [usuarioId]);
  return null;
}
