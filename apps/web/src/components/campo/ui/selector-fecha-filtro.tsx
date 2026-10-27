"use client";

import React, { useId, useState, useRef, useEffect } from "react";
import { fechaEnZonaIso, textoRangoFechas } from "@/utils/fechas";
import { periodosDesdeHoy } from "@/utils/periodo-inicio";
import type { PeriodoFiltro } from "@/types/periodo-filtro";
import { useHojaDeslizable } from "@/hooks/use-hoja-deslizable";

interface SelectorFechaFiltroProps {
  valorActual: PeriodoFiltro;
  onChange: (periodo: PeriodoFiltro) => void;
}

export function SelectorFechaFiltro({ valorActual, onChange }: SelectorFechaFiltroProps) {
  const hoyStr = fechaEnZonaIso(new Date());
  const presets = periodosDesdeHoy(hoyStr);
  const seleccion = presets.find((p) => p.clave === valorActual.clave) ?? valorActual;
  // A la vista van Hoy, Ayer, 7 días y Mes; el calendario es solo para un rango personalizado.
  const otroPeriodo = !presets.some((p) => p.clave === valorActual.clave);
  const [abierto, setAbierto] = useState(false);
  const panelId = useId();
  // Desde `sm` el panel flota junto al botón, del lado donde hay lugar.
  const [alinearIzquierda, setAlinearIzquierda] = useState(false);
  const [desdePersonalizado, setDesdePersonalizado] = useState(
    seleccion.fechaInicio ?? seleccion.fecha ?? hoyStr,
  );
  const [hastaPersonalizado, setHastaPersonalizado] = useState(
    seleccion.fechaFin ?? seleccion.fecha ?? hoyStr,
  );
  const popoverRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const fondoRef = useRef<HTMLDivElement>(null);
  const { activa: hojaActiva, minimizar: minimizarHoja, arrastre } = useHojaDeslizable({ abierto, panelRef, fondoRef, onMinimizar: () => setAbierto(false) });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        if (hojaActiva) minimizarHoja();
        else setAbierto(false);
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
  }, [abierto, hojaActiva, minimizarHoja]);

  const alternar = () => {
    const caja = popoverRef.current?.getBoundingClientRect();
    // 20rem del panel: si a la izquierda del botón no entra, se abre hacia la derecha.
    if (caja) setAlinearIzquierda(caja.right < 336);
    setDesdePersonalizado(seleccion.fechaInicio ?? seleccion.fecha ?? hoyStr);
    setHastaPersonalizado(seleccion.fechaFin ?? seleccion.fecha ?? hoyStr);
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
          : textoRangoFechas(inicio, fin),
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
    <div className="relative flex min-w-0 flex-wrap items-center gap-1.5 text-left" ref={popoverRef}>
      <div role="group" aria-label="Período" className="flex min-w-0 items-center gap-1.5">
        {presets.map((p) => {
          const activo = valorActual.clave === p.clave;
          return (
            <button
              key={p.clave}
              type="button"
              aria-pressed={activo}
              onClick={() => seleccionarPreset(p)}
              className={`min-h-11 shrink-0 cursor-pointer whitespace-nowrap rounded-full border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                activo
                  ? "border-brand-700 bg-brand-700 text-white dark:border-brand-500 dark:bg-brand-500 dark:text-brand-950"
                  : "border-line bg-surface-raised text-foreground hover:bg-surface-soft"
              }`}
            >
              {p.etiqueta}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={alternar}
        aria-expanded={abierto}
        aria-controls={panelId}
        aria-haspopup="dialog"
        aria-label={otroPeriodo ? `Período: ${valorActual.etiqueta}. Personalizar fecha` : "Personalizar fecha"}
        title="Personalizar fecha"
        className={`ml-auto flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
          otroPeriodo
            ? "border-brand-700 bg-brand-700 text-white dark:border-brand-500 dark:bg-brand-500 dark:text-brand-950"
            : "border-line bg-surface-raised text-accent-ink hover:bg-surface-soft"
        }`}
      >
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        {/* Con un período fuera de los chips, el calendario dice cuál es. */}
        {otroPeriodo ? <span className="max-w-[9rem] truncate">{valorActual.etiqueta}</span> : null}
      </button>

      {abierto && (
        <>
        {/* En celular es una hoja desde abajo: nunca queda fuera de la pantalla. */}
        <div
          ref={fondoRef}
          aria-hidden="true"
          onClick={minimizarHoja}
          className="fixed inset-0 z-[60] bg-black/40 sm:hidden"
        />
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label="Fecha personalizada"
          className={`fixed inset-x-0 bottom-0 z-[61] max-h-[85dvh] overflow-y-auto rounded-t-2xl border border-line bg-surface-raised p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-foreground shadow-2xl max-sm:motion-safe:animate-hoja-subir sm:absolute sm:inset-x-auto sm:bottom-auto sm:z-50 sm:mt-2 sm:max-h-[70dvh] sm:w-80 sm:rounded-xl sm:p-3 ${
            alinearIzquierda ? "sm:left-0" : "sm:right-0"
          }`}
        >
          <div {...arrastre} className="max-sm:touch-none max-sm:select-none max-sm:cursor-grab max-sm:active:cursor-grabbing">
            <span aria-hidden="true" className="mx-auto mb-3 block h-1 w-10 rounded-full bg-line sm:hidden" />
            <div className="mb-2 flex flex-wrap items-center justify-between gap-1 border-b border-line pb-2">
              <span className="ft-display text-xs font-bold uppercase tracking-wider text-accent-ink">
                Fecha personalizada
              </span>
              <span className="min-w-0 break-all text-right font-mono text-[11px] text-muted">
                {rangoVisible}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
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
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="min-h-11 cursor-pointer rounded-lg border border-line bg-surface-raised px-2 text-xs font-semibold text-foreground hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={aplicarRango}
              disabled={!desdePersonalizado || !hastaPersonalizado}
              className="min-h-11 cursor-pointer rounded-lg bg-brand-700 px-2 text-xs font-semibold text-white hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50 dark:bg-brand-500 dark:text-brand-950 dark:hover:bg-brand-400"
            >
              Aplicar rango
            </button>
          </div>
        </div>
        </>
      )}
    </div>
  );
}
