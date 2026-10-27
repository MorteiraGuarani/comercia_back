"use client";

import React, { useId, useState, useRef, useEffect } from "react";
import { fechaEnZonaIso } from "@/utils/fechas";
import { periodosDesdeHoy } from "@/utils/periodo-inicio";
import type { PeriodoFiltro } from "@/types/periodo-filtro";

interface SelectorFechaFiltroProps {
  valorActual: PeriodoFiltro;
  onChange: (periodo: PeriodoFiltro) => void;
}

export function SelectorFechaFiltro({ valorActual, onChange }: SelectorFechaFiltroProps) {
  const hoyStr = fechaEnZonaIso(new Date());
  const presets = periodosDesdeHoy(hoyStr);
  const seleccion = presets.find((p) => p.clave === valorActual.clave) ?? valorActual;
  const [abierto, setAbierto] = useState(false);
  const [personalizadoAbierto, setPersonalizadoAbierto] = useState(false);
  const panelId = useId();
  const personalizadoId = useId();
  // Desde `sm` el panel flota junto al botón, del lado donde hay lugar.
  const [alinearIzquierda, setAlinearIzquierda] = useState(false);
  const [desdePersonalizado, setDesdePersonalizado] = useState(
    seleccion.fechaInicio ?? seleccion.fecha ?? hoyStr,
  );
  const [hastaPersonalizado, setHastaPersonalizado] = useState(
    seleccion.fechaFin ?? seleccion.fecha ?? hoyStr,
  );
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    }
    function cerrarConEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setAbierto(false);
    }
    if (abierto) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", cerrarConEscape);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", cerrarConEscape);
    };
  }, [abierto]);

  const alternar = () => {
    const caja = popoverRef.current?.getBoundingClientRect();
    // 20rem del panel: si a la izquierda del botón no entra, se abre hacia la derecha.
    if (caja) setAlinearIzquierda(caja.right < 336);
    setDesdePersonalizado(seleccion.fechaInicio ?? seleccion.fecha ?? hoyStr);
    setHastaPersonalizado(seleccion.fechaFin ?? seleccion.fecha ?? hoyStr);
    setPersonalizadoAbierto(false);
    setAbierto((prev) => !prev);
  };

  const seleccionarPreset = (p: PeriodoFiltro) => {
    onChange(p);
    setDesdePersonalizado(p.fechaInicio ?? p.fecha ?? hoyStr);
    setHastaPersonalizado(p.fechaFin ?? p.fecha ?? hoyStr);
    setAbierto(false);
  };

  const aplicarRango = () => {
    if (!desdePersonalizado || !hastaPersonalizado) return;
    const inicio =
      desdePersonalizado <= hastaPersonalizado
        ? desdePersonalizado
        : hastaPersonalizado;
    const fin =
      desdePersonalizado <= hastaPersonalizado
        ? hastaPersonalizado
        : desdePersonalizado;
    onChange({
      clave: inicio === fin ? "personalizado" : "rango",
      etiqueta:
        inicio === fin
          ? new Date(inicio + "T12:00:00").toLocaleDateString("es-AR", {
              day: "numeric",
              month: "short",
            })
          : `${inicio} — ${fin}`,
      fecha: inicio === fin ? inicio : undefined,
      fechaInicio: inicio,
      fechaFin: fin,
    });
    setAbierto(false);
  };

  const rangoVisible =
    seleccion.fechaInicio && seleccion.fechaFin
      ? `${seleccion.fechaInicio} — ${seleccion.fechaFin}`
      : (seleccion.fecha ?? hoyStr);

  return (
    <div className="relative inline-block text-left" ref={popoverRef}>
      <button
        type="button"
        onClick={alternar}
        aria-expanded={abierto}
        aria-controls={panelId}
        aria-haspopup="dialog"
        className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface-raised px-3 py-2 text-xs text-foreground shadow-sm transition-colors hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40"
        title="Cambiar fecha o período de visualización"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent-ink">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>

        <div className="flex flex-col text-left">
          <span className="text-[10px] uppercase font-bold tracking-wider text-muted leading-none">
            Período:
          </span>
          <span className="ft-mono font-bold text-xs text-foreground leading-tight mt-0.5">
            {valorActual.etiqueta}
          </span>
        </div>

        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`text-muted transition-transform ${abierto ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {abierto && (
        <>
        {/* En celular es una hoja desde abajo: nunca queda fuera de la pantalla. */}
        <div
          aria-hidden="true"
          onClick={() => setAbierto(false)}
          className="fixed inset-0 z-[60] bg-black/40 sm:hidden"
        />
        <div
          id={panelId}
          role="dialog"
          aria-label="Elegir período"
          className={`fixed inset-x-0 bottom-0 z-[61] max-h-[85dvh] overflow-y-auto rounded-t-2xl border border-line bg-surface-raised p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-foreground shadow-2xl max-sm:motion-safe:animate-hoja-subir sm:absolute sm:inset-x-auto sm:bottom-auto sm:z-50 sm:mt-2 sm:max-h-[70dvh] sm:w-80 sm:rounded-xl sm:p-3 ${
            alinearIzquierda ? "sm:left-0" : "sm:right-0"
          }`}
        >
          <span aria-hidden="true" className="mx-auto mb-3 block h-1 w-10 rounded-full bg-line sm:hidden" />
          <div className="mb-2 flex flex-wrap items-center justify-between gap-1 border-b border-line pb-2">
            <span className="ft-display text-xs font-bold uppercase tracking-wider text-accent-ink">
              Filtro Temporal
            </span>
            <span className="min-w-0 break-all text-right font-mono text-[11px] text-muted">
              {rangoVisible}
            </span>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
              Fechas predefinidas
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {presets.map((p) => {
                const esActivo = valorActual.clave === p.clave;
                return (
                  <button
                    key={p.clave}
                    type="button"
                    onClick={() => seleccionarPreset(p)}
                    aria-pressed={esActivo}
                    className={`flex min-h-11 cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 ${
                      esActivo
                        ? "bg-accent-ink text-background font-bold shadow"
                        : "border border-line bg-surface-raised text-foreground hover:bg-surface-soft"
                    }`}
                  >
                    <span>{p.etiqueta}</span>
                    {esActivo && (
                      <svg className="h-3 w-3 shrink-0 text-background" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="mt-3 rounded-lg border border-line bg-surface-soft p-2">
            <button
              type="button"
              aria-expanded={personalizadoAbierto}
              aria-controls={personalizadoId}
              onClick={() => setPersonalizadoAbierto((prev) => !prev)}
              className="flex min-h-11 w-full items-center justify-between gap-2 rounded px-1 text-left text-xs font-semibold text-foreground hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              Fecha personalizada
              <span aria-hidden="true">{personalizadoAbierto ? "−" : "+"}</span>
            </button>
            <div id={personalizadoId} hidden={!personalizadoAbierto}>
              <div className="grid grid-cols-1 gap-2">
                <label className="block min-w-0 text-[10px] uppercase tracking-wider text-muted">
                  Desde
                  <input
                    type="date"
                    value={desdePersonalizado}
                    onChange={(e) => setDesdePersonalizado(e.target.value)}
                    className="mt-1 min-h-11 w-full min-w-0 cursor-pointer rounded border border-line bg-surface-raised px-2 py-1.5 text-xs text-foreground outline-none focus:border-accent-ink focus:ring-2 focus:ring-brand-600/30 ft-mono"
                  />
                </label>
                <label className="block min-w-0 text-[10px] uppercase tracking-wider text-muted">
                  Hasta
                  <input
                    type="date"
                    value={hastaPersonalizado}
                    min={desdePersonalizado}
                    onChange={(e) => setHastaPersonalizado(e.target.value)}
                    className="mt-1 min-h-11 w-full min-w-0 cursor-pointer rounded border border-line bg-surface-raised px-2 py-1.5 text-xs text-foreground outline-none focus:border-accent-ink focus:ring-2 focus:ring-brand-600/30 ft-mono"
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={aplicarRango}
                disabled={!desdePersonalizado || !hastaPersonalizado}
                className="disabled:cursor-not-allowed disabled:opacity-50 mt-2 min-h-11 w-full cursor-pointer rounded-lg border border-line bg-surface-raised px-2 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40"
              >
                Aplicar rango
              </button>
            </div>
          </div>
        </div>
        </>
      )}
    </div>
  );
}
