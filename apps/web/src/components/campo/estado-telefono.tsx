"use client";
import { useId, useState } from "react";
import { useEstadoTelefonoRepositor } from "@/hooks/use-estado-telefono-repositor";
import { Modal } from "@/components/modal";
import { PantallaCarga } from "@/components/pantalla-carga";
import { formatoFechaHora } from "@/utils/fechas";
import { TOKENS } from "./tokens";

export function EstadoTelefono({
  variante = "panel",
}: {
  variante?: "panel" | "boton";
}) {
  const { estado, actualizando, comprobadoEn, comprobar } = useEstadoTelefonoRepositor();
  const [detalles, setDetalles] = useState(false);
  const detalleId = useId();
  const etiqueta = estado
    ? {
        LISTO: "Listo para marcar",
        SIN_DATOS: "Sin ubicación",
        DESACTUALIZADO: "Actualizar ubicación",
        NO_HABILITADO: "Cuenta no habilitada",
        SIN_CONEXION: "No se pudo comprobar",
        SEGUIMIENTO_DETENIDO: "Activar seguimiento",
      }[estado.estado]
    : "Comprobando teléfono…";
  const indicador = (
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
  );
  const informacion = (
    <>
      <p>{actualizando ? "Consultando el seguimiento y la ubicación del teléfono…" : estado?.mensaje ?? "Consultando el estado del teléfono…"}</p>
      {estado?.capturadaEn ? (
        <p>
          Última ubicación:{" "}
          {formatoFechaHora(estado.capturadaEn)}
          {estado.precisionMetros != null
            ? ` · precisión ±${Math.round(estado.precisionMetros)} m`
            : ""}
        </p>
      ) : null}
      {!actualizando && comprobadoEn ? (
        <p className="font-mono text-xs">Última comprobación: {formatoFechaHora(comprobadoEn)}</p>
      ) : null}
      <p>Este botón consulta el teléfono. El seguimiento laboral se inicia desde la app UCheck.</p>
      {estado?.estado === "LISTO" ? (
        <p>Mantené el seguimiento de UCheck activo durante la visita.</p>
      ) : estado && estado.estado !== "SIN_CONEXION" && estado.estado !== "NO_HABILITADO" ? (
        <p>Después de activar o actualizar el seguimiento en tu teléfono, volvé a comprobar.</p>
      ) : null}
    </>
  );
  if (variante === "boton") {
    return (
      <aside aria-label="Estado de UCheck" className="campo-screen shrink-0">
        <PantallaCarga
          visible={actualizando}
          mensaje="Comprobando UCheck"
          detalle="Consultando el estado y la última ubicación del teléfono."
        />
        <button
          type="button"
          disabled={actualizando}
          onClick={() => {
            setDetalles(true);
            comprobar();
          }}
          aria-haspopup="dialog"
          aria-expanded={detalles}
          aria-label={`Seguimiento de UCheck: ${etiqueta}`}
          title={`UCheck · ${etiqueta}`}
          className="flex h-11 min-h-11 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-line bg-surface-soft px-2 text-xs font-semibold text-foreground transition-colors hover:bg-surface-raised active:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50 sm:px-3 sm:text-sm dark:border-line dark:bg-surface-soft dark:text-foreground dark:hover:bg-surface-raised dark:active:bg-surface-raised"
        >
          {indicador}
          UCheck seguimiento
        </button>
        <span className="sr-only" role="status">{etiqueta}</span>
        <Modal
          titulo="Seguimiento de UCheck"
          abierto={detalles}
          onCerrar={() => setDetalles(false)}
        >
          <p aria-live="polite" className="flex items-center gap-2 text-sm font-semibold text-foreground dark:text-foreground">
            {indicador}
            {actualizando ? "Comprobando UCheck…" : etiqueta}
          </p>
          <div className="mt-3 space-y-2 text-sm leading-relaxed text-muted dark:text-muted">
            {informacion}
          </div>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              aria-label="Comprobar UCheck"
              disabled={actualizando}
              onClick={comprobar}
              className="min-h-11 cursor-pointer whitespace-nowrap rounded-lg border border-line bg-surface-soft px-3 text-sm font-semibold text-foreground transition-colors hover:bg-surface-raised active:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50 dark:border-line dark:bg-surface-soft dark:text-foreground dark:hover:bg-surface-raised dark:active:bg-surface-raised"
            >
              {actualizando ? "Comprobando…" : "Volver a comprobar"}
            </button>
            <button
              type="button"
              onClick={() => setDetalles(false)}
              className="min-h-11 cursor-pointer whitespace-nowrap rounded-lg px-3 text-sm text-muted transition-colors hover:bg-surface-soft active:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus dark:text-muted dark:hover:bg-surface-soft dark:active:bg-surface-soft"
            >
              Cerrar
            </button>
          </div>
        </Modal>
      </aside>
    );
  }
  return (
    <aside
      aria-label="Estado de UCheck"
      className="campo-screen min-w-0 rounded-lg border border-line bg-surface-soft text-foreground dark:border-line dark:bg-surface-soft dark:text-foreground"
    >
      <PantallaCarga
        visible={actualizando}
        mensaje="Comprobando UCheck"
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
          {indicador}
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
            setDetalles(true);
            comprobar();
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
        {informacion}
      </div>
    </aside>
  );
}
