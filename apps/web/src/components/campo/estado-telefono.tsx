"use client";
import { useEffect, useId, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { PantallaCarga } from "@/components/pantalla-carga";
import type { EstadoTelefonoRepositor } from "@/types/seguimiento";
import { TOKENS } from "./tokens";

export function EstadoTelefono() {
  const [estado, setEstado] = useState<EstadoTelefonoRepositor | null>(null);
  const [revision, setRevision] = useState(0);
  const [actualizando, setActualizando] = useState(false);
  const manualEnCurso = useRef(false);
  const [detalles, setDetalles] = useState(false);
  const detalleId = useId();
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
  const etiqueta = estado
    ? {
        LISTO: "Listo para marcar",
        SIN_DATOS: "Sin ubicación",
        DESACTUALIZADO: "Actualizar ubicación",
        NO_HABILITADO: "Cuenta no habilitada",
        SIN_CONEXION: "Sin conexión",
        SEGUIMIENTO_DETENIDO: "Activar seguimiento",
      }[estado.estado]
    : "Comprobando teléfono…";
  return (
    <aside
      aria-label="Estado de UCheck"
      className="campo-screen min-w-0 rounded-lg border border-line bg-surface-soft text-foreground dark:border-line dark:bg-surface-soft dark:text-foreground"
    >
      <PantallaCarga
        visible={actualizando}
        mensaje="Comprobando Ucheck"
        detalle="Consultando el estado y la última ubicación del teléfono."
      />
      <div className="flex min-w-0 items-center">
        <button
          type="button"
          onClick={() => setDetalles((v) => !v)}
          aria-expanded={detalles}
          aria-controls={detalleId}
          aria-label={`${detalles ? "Ocultar" : "Ver"} detalles de UCheck: ${etiqueta}`}
          title={`UCheck · ${etiqueta}`}
          className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-l-lg px-3 text-left text-xs transition hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus dark:hover:bg-surface-raised"
        >
          <span
            aria-hidden="true"
            className="h-2 w-2 shrink-0 rounded-full"
            style={{
              background:
                estado?.estado === "LISTO"
                  ? TOKENS.fresco
                  : estado
                    ? TOKENS.alerta
                    : TOKENS.sub,
            }}
          />
          <span aria-live="polite" className="min-w-0 flex-1 truncate">
            <strong>UCheck</strong> · {etiqueta}
          </span>
          <svg
            aria-hidden="true"
            className={`h-3.5 w-3.5 shrink-0 transition-transform motion-reduce:transition-none ${detalles ? "rotate-180" : ""}`}
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="m5 7.5 5 5 5-5" />
          </svg>
        </button>
        <button
          type="button"
          disabled={actualizando}
          aria-label="Comprobar UCheck"
          title="Comprobar UCheck"
          className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-r-lg border-l border-line text-muted transition hover:bg-surface-raised hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50 dark:border-line dark:hover:bg-surface-raised dark:hover:text-foreground"
          onClick={() => {
            if (manualEnCurso.current) return;
            manualEnCurso.current = true;
            setActualizando(true);
            setRevision((r) => r + 1);
          }}
        >
          <svg
            aria-hidden="true"
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
          >
            <path d="M20 7v5h-5M4 17v-5h5" />
            <path d="M6.1 7A7 7 0 0 1 18 6l2 2M4 16l2 2a7 7 0 0 0 11.9-1" />
          </svg>
        </button>
      </div>
      <div
        id={detalleId}
        hidden={!detalles}
        className="space-y-1 border-t border-line px-3 py-2 text-xs leading-relaxed text-muted dark:border-line dark:text-muted"
      >
        <p>{estado?.mensaje ?? "Consultando el estado del teléfono…"}</p>
        {estado?.capturadaEn ? (
          <p>
            Última ubicación:{" "}
            {new Date(estado.capturadaEn).toLocaleTimeString("es-PY")}
            {estado.precisionMetros != null
              ? ` · precisión ±${Math.round(estado.precisionMetros)} m`
              : ""}
          </p>
        ) : null}
        <p>Mantené el seguimiento de UCheck activo durante la visita.</p>
      </div>
    </aside>
  );
}
