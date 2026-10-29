"use client";

import { createContext, useContext, useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { ContextoInstalacionPwa, EventoInstalacionPwa } from "@/types/pwa";

const Contexto = createContext<ContextoInstalacionPwa | null>(null);

function leerModoInstalado() {
  return window.isSecureContext && (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function suscribirModoInstalado(notificar: () => void) {
  if (!window.isSecureContext) return () => undefined;
  const modo = window.matchMedia("(display-mode: standalone)");
  modo.addEventListener("change", notificar);
  return () => modo.removeEventListener("change", notificar);
}

function leerIos() {
  return window.isSecureContext && (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

const sinSuscripcion = () => () => undefined;
const estadoServidor = () => false;

// Se monta en la raíz para conservar la invitación al pasar del login al panel.
export function InstalacionPwaProvider({ children }: { children: ReactNode }) {
  const [evento, setEvento] = useState<EventoInstalacionPwa | null>(null);
  const ios = useSyncExternalStore(sinSuscripcion, leerIos, estadoServidor);
  const modoInstalado = useSyncExternalStore(suscribirModoInstalado, leerModoInstalado, estadoServidor);
  const [instalada, setInstalada] = useState(false);
  const [instalando, setInstalando] = useState(false);
  const [ayuda, setAyuda] = useState("");
  const enProceso = useRef(false);

  useEffect(() => {
    if (!window.isSecureContext) return;
    const alDisponible = (e: Event) => {
      e.preventDefault();
      setEvento(e as EventoInstalacionPwa);
      setAyuda("");
    };
    const alInstalar = () => {
      setInstalada(true);
      setEvento(null);
      setAyuda("");
    };
    window.addEventListener("beforeinstallprompt", alDisponible);
    window.addEventListener("appinstalled", alInstalar);
    return () => {
      window.removeEventListener("beforeinstallprompt", alDisponible);
      window.removeEventListener("appinstalled", alInstalar);
    };
  }, []);

  async function instalar() {
    if (enProceso.current) return;
    if (!evento) {
      if (ios) setAyuda("En Safari, abrí Compartir, elegí Agregar a inicio y confirmá Agregar.");
      return;
    }
    enProceso.current = true;
    setInstalando(true);
    setAyuda("");
    try {
      await evento.prompt();
      if ((await evento.userChoice).outcome === "accepted") setInstalada(true);
    } catch {
      setAyuda("No se pudo abrir la instalación. Podés intentarlo desde el menú del navegador.");
    } finally {
      // La invitación nativa solo se puede usar una vez, incluso si se cancela.
      setEvento(null);
      enProceso.current = false;
      setInstalando(false);
    }
  }

  return (
    <Contexto.Provider value={{ disponible: !instalada && !modoInstalado && (evento !== null || ios), instalando, ayuda, instalar }}>
      {children}
    </Contexto.Provider>
  );
}

export function BotonInstalarPwa({ className, enMenu = false }: { className: string; enMenu?: boolean }) {
  const estado = useContext(Contexto);
  const idAyuda = useId();
  if (!estado || (!estado.disponible && !estado.ayuda)) return null;
  return (
    <div className="pwa-instalacion" role={enMenu ? "none" : undefined}>
      {estado.disponible && (
        <button
          type="button"
          role={enMenu ? "menuitem" : undefined}
          className={className}
          onClick={() => void estado.instalar()}
          disabled={estado.instalando}
          aria-busy={estado.instalando || undefined}
          aria-describedby={estado.ayuda ? idAyuda : undefined}
        >
          {estado.instalando ? "Abriendo instalación…" : "Instalar comercIA"}
        </button>
      )}
      {estado.ayuda && <p id={idAyuda} className="pwa-instalacion__ayuda" role="status">{estado.ayuda}</p>}
    </div>
  );
}
