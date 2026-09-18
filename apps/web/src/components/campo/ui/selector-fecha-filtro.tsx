"use client";

import React, { useState, useRef, useEffect } from "react";
import { fechaEnZonaIso } from "@/utils/fechas";

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

export function SelectorFechaFiltro({ valorActual, onChange }: SelectorFechaFiltroProps) {
  const [abierto, setAbierto] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Cerrar al hacer clic afuera
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

  // Generar presets calculados con respecto a hoy
  const hoyObj = new Date();
  const hoyStr = fechaEnZonaIso(hoyObj);

  const ayerObj = new Date(hoyObj);
  ayerObj.setDate(hoyObj.getDate() - 1);
  const ayerStr = fechaEnZonaIso(ayerObj);

  // Esta semana (Lunes a hoy)
  const diaSemana = hoyObj.getDay() === 0 ? 7 : hoyObj.getDay();
  const lunesSemanaObj = new Date(hoyObj);
  lunesSemanaObj.setDate(hoyObj.getDate() - (diaSemana - 1));
  const lunesSemanaStr = fechaEnZonaIso(lunesSemanaObj);

  // Semana pasada (Lunes a Domingo anterior)
  const lunesSemanaPasadaObj = new Date(lunesSemanaObj);
  lunesSemanaPasadaObj.setDate(lunesSemanaObj.getDate() - 7);
  const domingoSemanaPasadaObj = new Date(lunesSemanaObj);
  domingoSemanaPasadaObj.setDate(lunesSemanaObj.getDate() - 1);
  const lunesSemanaPasadaStr = fechaEnZonaIso(lunesSemanaPasadaObj);
  const domingoSemanaPasadaStr = fechaEnZonaIso(domingoSemanaPasadaObj);

  // Este mes
  const primerDiaMesObj = new Date(hoyObj.getFullYear(), hoyObj.getMonth(), 1);
  const primerDiaMesStr = fechaEnZonaIso(primerDiaMesObj);

  // Mes pasado
  const primerDiaMesPasadoObj = new Date(hoyObj.getFullYear(), hoyObj.getMonth() - 1, 1);
  const ultimoDiaMesPasadoObj = new Date(hoyObj.getFullYear(), hoyObj.getMonth(), 0);
  const primerDiaMesPasadoStr = fechaEnZonaIso(primerDiaMesPasadoObj);
  const ultimoDiaMesPasadoStr = fechaEnZonaIso(ultimoDiaMesPasadoObj);

  // Trimestre actual
  const mesActual = hoyObj.getMonth();
  const trimInicioMes = Math.floor(mesActual / 3) * 3;
  const primerDiaTrimObj = new Date(hoyObj.getFullYear(), trimInicioMes, 1);
  const primerDiaTrimStr = fechaEnZonaIso(primerDiaTrimObj);

  // Semestre actual
  const semInicioMes = mesActual < 6 ? 0 : 6;
  const primerDiaSemObj = new Date(hoyObj.getFullYear(), semInicioMes, 1);
  const primerDiaSemStr = fechaEnZonaIso(primerDiaSemObj);

  const presets: PeriodoFiltro[] = [
    {
      clave: "hoy",
      etiqueta: "Hoy",
      fecha: hoyStr,
      fechaInicio: hoyStr,
      fechaFin: hoyStr,
    },
    {
      clave: "ayer",
      etiqueta: "Ayer",
      fecha: ayerStr,
      fechaInicio: ayerStr,
      fechaFin: ayerStr,
    },
    {
      clave: "esta_semana",
      etiqueta: "Esta semana",
      fechaInicio: lunesSemanaStr,
      fechaFin: hoyStr,
    },
    {
      clave: "semana_pasada",
      etiqueta: "Semana pasada",
      fechaInicio: lunesSemanaPasadaStr,
      fechaFin: domingoSemanaPasadaStr,
    },
    {
      clave: "este_mes",
      etiqueta: "Este mes",
      fechaInicio: primerDiaMesStr,
      fechaFin: hoyStr,
    },
    {
      clave: "mes_pasado",
      etiqueta: "Mes pasado",
      fechaInicio: primerDiaMesPasadoStr,
      fechaFin: ultimoDiaMesPasadoStr,
    },
    {
      clave: "este_trimestre",
      etiqueta: `Trimestre ${Math.floor(mesActual / 3) + 1}`,
      fechaInicio: primerDiaTrimStr,
      fechaFin: hoyStr,
    },
    {
      clave: "este_semestre",
      etiqueta: `Semestre ${mesActual < 6 ? 1 : 2}`,
      fechaInicio: primerDiaSemStr,
      fechaFin: hoyStr,
    },
  ];

  const seleccionarPreset = (p: PeriodoFiltro) => {
    onChange(p);
    setAbierto(false);
  };

  const seleccionarFechaDirecta = (nuevaFecha: string) => {
    if (!nuevaFecha) return;
    onChange({
      clave: "personalizado",
      etiqueta: new Date(nuevaFecha + "T12:00:00").toLocaleDateString("es-AR", {
        day: "numeric",
        month: "short",
      }),
      fecha: nuevaFecha,
      fechaInicio: nuevaFecha,
      fechaFin: nuevaFecha,
    });
    setAbierto(false);
  };

  return (
    <div className="relative inline-block text-left" ref={popoverRef}>
      {/* Botón Principal del Selector */}
      <button
        type="button"
        onClick={() => setAbierto((prev) => !prev)}
        aria-expanded={abierto}
        className="flex min-h-11 items-center gap-2 rounded-lg border border-line bg-surface-raised px-3 py-2 text-xs text-foreground shadow-sm transition-colors hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40"
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

      {/* Popover Desplegable */}
      {abierto && (
        <div
          className="absolute right-0 z-50 mt-2 w-72 rounded-xl border border-line bg-surface-raised p-3 text-foreground shadow-2xl animate-in fade-in zoom-in-95 duration-100 sm:w-80"
        >
          {/* Header del Popover */}
          <div className="mb-2 flex items-center justify-between border-b border-line pb-2">
            <span className="ft-display text-xs font-bold uppercase tracking-wider text-accent-ink">
              Filtro Temporal
            </span>
            <span className="text-[11px] text-muted font-mono">
              {valorActual.fechaInicio && valorActual.fechaFin
                ? `${valorActual.fechaInicio} — ${valorActual.fechaFin}`
                : valorActual.fecha ?? hoyStr}
            </span>
          </div>

          {/* Selector de Fecha Puntual (Calendario Nativo) */}
          <div className="mb-3 rounded-lg border border-line bg-surface-soft p-2">
            <label className="mb-1 block text-[11px] font-medium text-muted">
              Elegir fecha específica (Calendario):
            </label>
            <input
              type="date"
              value={valorActual.fecha ?? valorActual.fechaInicio ?? hoyStr}
              onChange={(e) => seleccionarFechaDirecta(e.target.value)}
              className="w-full cursor-pointer rounded border border-line bg-surface-raised px-2 py-1.5 text-xs text-foreground outline-none focus:border-accent-ink focus:ring-2 focus:ring-brand-600/30 ft-mono"
            />
          </div>

          {/* Accesos Rápidos Predefinidos */}
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
                    className={`text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center justify-between cursor-pointer ${
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
