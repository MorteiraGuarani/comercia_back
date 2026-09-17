"use client";

import React, { useState, useRef, useEffect } from "react";
import { TOKENS } from "../tokens";
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
        className="flex items-center gap-2 rounded-lg px-3 py-2 bg-zinc-900 border border-zinc-700 text-white text-xs hover:border-zinc-500 transition-all cursor-pointer shadow-sm"
        title="Cambiar fecha o período de visualización"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#C9A54A" strokeWidth="2">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>

        <div className="flex flex-col text-left">
          <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 leading-none">
            Período:
          </span>
          <span className="ft-mono font-bold text-xs text-white leading-tight mt-0.5">
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
          className={`text-zinc-400 transition-transform ${abierto ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Popover Desplegable */}
      {abierto && (
        <div
          className="absolute right-0 mt-2 w-72 sm:w-80 rounded-xl border shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95 duration-100"
          style={{
            background: "#1E2320",
            borderColor: "#33362F",
            color: "#ECE9E2",
          }}
        >
          {/* Header del Popover */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-800">
            <span className="ft-display text-xs font-bold uppercase tracking-wider text-[#C9A54A]">
              Filtro Temporal
            </span>
            <span className="text-[11px] text-zinc-400 font-mono">
              {valorActual.fechaInicio && valorActual.fechaFin
                ? `${valorActual.fechaInicio} — ${valorActual.fechaFin}`
                : valorActual.fecha ?? hoyStr}
            </span>
          </div>

          {/* Selector de Fecha Puntual (Calendario Nativo) */}
          <div className="mb-3 p-2 rounded-lg bg-zinc-900 border border-zinc-800">
            <label className="block text-[11px] text-zinc-400 mb-1 font-medium">
              Elegir fecha específica (Calendario):
            </label>
            <input
              type="date"
              value={valorActual.fecha ?? valorActual.fechaInicio ?? hoyStr}
              onChange={(e) => seleccionarFechaDirecta(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-white ft-mono outline-none focus:border-[#C9A54A] cursor-pointer"
            />
          </div>

          {/* Accesos Rápidos Predefinidos */}
          <div>
            <p className="text-[11px] text-zinc-400 uppercase font-semibold tracking-wider mb-2">
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
                        ? "bg-[#C9A54A] text-black font-bold shadow"
                        : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white border border-zinc-800"
                    }`}
                  >
                    <span>{p.etiqueta}</span>
                    {esActivo && (
                      <svg className="w-3 h-3 text-black shrink-0" viewBox="0 0 20 20" fill="currentColor">
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
