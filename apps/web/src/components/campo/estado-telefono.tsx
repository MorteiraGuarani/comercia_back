"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { EstadoTelefonoRepositor } from "@/types/seguimiento";

export function EstadoTelefono() {
  const [estado, setEstado] = useState<EstadoTelefonoRepositor | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let vigente = true,
      pendiente = false;
    const controlador = new AbortController();
    async function cargar() {
      if (pendiente || document.hidden) return;
      pendiente = true;
      try {
        const r = await apiFetch<EstadoTelefonoRepositor>(
          "/campo/jornada/repositor/telefono",
          { signal: controlador.signal },
        );
        if (vigente) setEstado(r);
      } catch {
        if (vigente)
          setEstado({
            estado: "SIN_CONEXION",
            mensaje: "No se pudo consultar el teléfono. Revisá tu conexión.",
          });
      } finally {
        pendiente = false;
      }
    }
    void cargar();
    const timer = setInterval(() => void cargar(), 15000);
    return () => {
      vigente = false;
      controlador.abort();
      clearInterval(timer);
    };
  }, [revision]);
  return (
    <aside
      aria-live="polite"
      className="space-y-2 rounded-xl border border-line bg-surface-soft p-3 text-sm text-foreground"
    >
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
        className="min-h-11 rounded-lg border border-line px-3 hover:bg-surface-raised"
        onClick={() => setRevision((r) => r + 1)}
      >
        Comprobar Ucheck
      </button>
    </aside>
  );
}
