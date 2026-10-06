"use client";
import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { PantallaCarga } from "@/components/pantalla-carga";
import type { EstadoTelefonoRepositor } from "@/types/seguimiento";

export function EstadoTelefono() {
  const [estado, setEstado] = useState<EstadoTelefonoRepositor | null>(null);
  const [revision, setRevision] = useState(0);
  const [actualizando, setActualizando] = useState(false);
  const manualEnCurso = useRef(false);
  useEffect(() => {
    let vigente = true,
      pendiente = false;
    let controlador: AbortController | null = null;
    async function cargar() {
      if (pendiente || (document.hidden && !manualEnCurso.current)) return;
      pendiente = true;
      const esManual = manualEnCurso.current;
      const solicitud = new AbortController();
      controlador = solicitud;
      const limite = setTimeout(() => solicitud.abort(), 15000);
      try {
        const r = await apiFetch<EstadoTelefonoRepositor>(
          "/campo/jornada/repositor/telefono",
          { signal: solicitud.signal },
        );
        if (vigente) setEstado(r);
      } catch {
        if (vigente)
          setEstado({
            estado: "SIN_CONEXION",
            mensaje: "No se pudo consultar el teléfono. Revisá tu conexión.",
          });
      } finally {
        clearTimeout(limite);
        pendiente = false;
        if (vigente && esManual) {
          manualEnCurso.current = false;
          setActualizando(false);
        }
      }
    }
    void cargar();
    const timer = setInterval(() => void cargar(), 15000);
    return () => {
      vigente = false;
      controlador?.abort();
      clearInterval(timer);
    };
  }, [revision]);
  return (
    <aside
      aria-live="polite"
      className="space-y-2 rounded-xl border border-line bg-surface-soft p-3 text-sm text-foreground"
    >
      <PantallaCarga
        visible={actualizando}
        mensaje="Comprobando Ucheck"
        detalle="Consultando el estado y la última ubicación del teléfono."
      />
      <p className="font-semibold">
        Ucheck ·{" "}
        {estado?.estado === "LISTO"
          ? "Ubicación reciente"
          : "Verificación del teléfono"}
      </p>
      <p className="text-muted">
        {estado?.mensaje ?? "Consultando el estado…"}
      </p>
      {estado?.capturadaEn ? (
        <p className="text-xs text-muted">
          Última ubicación:{" "}
          {new Date(estado.capturadaEn).toLocaleTimeString("es-PY")}{" "}
          {estado.precisionMetros != null
            ? `· precisión ±${Math.round(estado.precisionMetros)} m`
            : ""}
        </p>
      ) : null}
      <button
        type="button"
        disabled={actualizando}
        className="min-h-11 rounded-lg border border-line px-3 hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-50"
        onClick={() => {
          if (manualEnCurso.current) return;
          manualEnCurso.current = true;
          setActualizando(true);
          setRevision((r) => r + 1);
        }}
      >
        Comprobar Ucheck
      </button>
    </aside>
  );
}
