"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  agregarDiasIso,
  fechaEnZonaIso,
  lunesDeIso,
} from "@/utils/fechas";

export interface PeriodoFiltro {
  clave: string;
  etiqueta: string;
  fecha?: string;
  fechaInicio?: string;
  fechaFin?: string;
}

interface SelectorFechaFiltroProps {
  valorActual: PeriodoFiltro;
  onChange: (periodo: PeriodoFiltro) => void;
}

function periodosDesdeHoy(hoy: string): PeriodoFiltro[] {
  const ayer = agregarDiasIso(hoy, -1);
  const lunes = lunesDeIso(hoy);
  const lunesPasado = agregarDiasIso(lunes, -7);
  const domingoPasado = agregarDiasIso(lunes, -1);
  const [anio, mes] = hoy.split("-").map(Number);
  const primerDiaMes = `${anio}-${String(mes).padStart(2, "0")}-01`;
  const mesPasado = mes === 1 ? 12 : mes - 1;
  const anioMesPasado = mes === 1 ? anio - 1 : anio;
  const primerDiaMesPasado = `${anioMesPasado}-${String(mesPasado).padStart(2, "0")}-01`;
  const ultimoDiaMesPasado = agregarDiasIso(primerDiaMes, -1);
  const trimInicioMes = Math.floor((mes - 1) / 3) * 3 + 1;
  const primerDiaTrim = `${anio}-${String(trimInicioMes).padStart(2, "0")}-01`;
  const semInicioMes = mes <= 6 ? 1 : 7;
  const primerDiaSem = `${anio}-${String(semInicioMes).padStart(2, "0")}-01`;

  return [
    { clave: "hoy", etiqueta: "Hoy", fecha: hoy, fechaInicio: hoy, fechaFin: hoy },
    { clave: "ayer", etiqueta: "Ayer", fecha: ayer, fechaInicio: ayer, fechaFin: ayer },
    {
      clave: "esta_semana",
      etiqueta: "Esta semana",
      fechaInicio: lunes,
      fechaFin: hoy,
    },
    {
      clave: "semana_pasada",
      etiqueta: "Semana pasada",
      fechaInicio: lunesPasado,
      fechaFin: domingoPasado,
    },
    {
      clave: "este_mes",
      etiqueta: "Este mes",
      fechaInicio: primerDiaMes,
      fechaFin: hoy,
    },
    {
      clave: "mes_pasado",
      etiqueta: "Mes pasado",
      fechaInicio: primerDiaMesPasado,
      fechaFin: ultimoDiaMesPasado,
    },
    {
      clave: "este_trimestre",
      etiqueta: `Trimestre ${Math.floor((mes - 1) / 3) + 1}`,
      fechaInicio: primerDiaTrim,
      fechaFin: hoy,
    },
    {
      clave: "este_semestre",
      etiqueta: `Semestre ${mes <= 6 ? 1 : 2}`,
      fechaInicio: primerDiaSem,
      fechaFin: hoy,
    },
  ];
}

export function SelectorFechaFiltro({ valorActual, onChange }: SelectorFechaFiltroProps) {
  const [abierto, setAbierto] = useState(false);
  const [desdePersonalizado, setDesdePersonalizado] = useState(
    valorActual.fechaInicio ?? valorActual.fecha ?? fechaEnZonaIso(new Date()),
  );
  const [hastaPersonalizado, setHastaPersonalizado] = useState(
    valorActual.fechaFin ?? valorActual.fecha ?? fechaEnZonaIso(new Date()),
  );
  const popoverRef = useRef<HTMLDivElement>(null);
  const hoyStr = fechaEnZonaIso(new Date());
  const presets = periodosDesdeHoy(hoyStr);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    }
    if (abierto) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [abierto]);

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
    valorActual.fechaInicio && valorActual.fechaFin
      ? `${valorActual.fechaInicio} — ${valorActual.fechaFin}`
      : (valorActual.fecha ?? hoyStr);

  return (
    <div className="relative inline-block text-left" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setAbierto((prev) => !prev)}
        aria-expanded={abierto}
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
        <div
          className="absolute right-0 z-50 mt-2 max-h-[60dvh] w-[min(18rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-line bg-surface-raised p-3 text-foreground shadow-2xl animate-in fade-in zoom-in-95 duration-100 sm:max-h-[70dvh] sm:w-80"
        >
          <div className="mb-2 flex flex-wrap items-center justify-between gap-1 border-b border-line pb-2">
            <span className="ft-display text-xs font-bold uppercase tracking-wider text-accent-ink">
              Filtro Temporal
            </span>
            <span className="min-w-0 break-all text-right font-mono text-[11px] text-muted">
              {rangoVisible}
            </span>
          </div>

          <div className="mb-3 rounded-lg border border-line bg-surface-soft p-2">
            <p className="mb-1 text-[11px] font-medium text-muted">
              Rango personalizado
            </p>
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
              className="mt-2 min-h-11 w-full cursor-pointer rounded-lg border border-line bg-surface-raised px-2 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40"
            >
              Aplicar rango
            </button>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
              Rangos Predefinidos:
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {presets.map((p) => {
                const esActivo = valorActual.clave === p.clave;
                return (
                  <button
                    key={p.clave}
                    type="button"
                    onClick={() => seleccionarPreset(p)}
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
        </div>
      )}
    </div>
  );
}
