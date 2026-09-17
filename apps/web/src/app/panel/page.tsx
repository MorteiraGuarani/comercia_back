"use client";

import Link from "next/link";
import { usePanel } from "@/components/panel/contexto";
import { TOKENS } from "@/components/campo/tokens";
import { StatusStamp } from "@/components/campo/ui/status-stamp";

export default function PanelInicioPage() {
  const { usuario, modulos } = usePanel();

  const tieneGestionCampo = modulos.some((m) => m.ruta === "gestion-campo");
  const tieneMiJornada = modulos.some((m) => m.ruta === "mi-jornada");

  return (
    <div className="min-w-0 space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Banner de Bienvenida con tipografía editorial */}
      <section
        className="rounded-2xl border p-6 sm:p-8 text-white shadow-sm"
        style={{ backgroundColor: TOKENS.ink, borderColor: TOKENS.ink }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.15em] text-[#C1752B]">
            {usuario.empresa.nombre} · Operaciones Comerciales de Campo
          </p>
          <StatusStamp tone="fresco" size="sm">
            SISTEMA OPERATIVO
          </StatusStamp>
        </div>

        <p className="mt-4 text-xs font-mono uppercase tracking-wider text-white/70">
          Sesión Activa: {usuario.nombre} {usuario.apellido || ""}
        </p>
        <h1 className="mt-1 text-3xl sm:text-4xl font-extrabold uppercase tracking-tight ft-display">
          Comercia — Control & Gestión de Campo
        </h1>
        <p className="mt-2 max-w-2xl text-xs sm:text-sm text-[#DAD5C9] leading-relaxed">
          Plataforma integral de supervisión de rutas, presentismo en tiempo real, cumplimiento
          de tareas en góndola, novedades operativas y canal prioritario de avisos.
        </p>
      </section>

      {!usuario.rol && !usuario.esSuperadmin && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
          <span className="font-bold">Tu cuenta está pendiente de rol.</span> Un administrador debe asignártelo para habilitar módulos.
        </div>
      )}

      {/* Acceso Rápido: Team Leader / Supervisión */}
      {tieneGestionCampo && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#726C60]">
              Supervisión de Equipo & Control de Campo (Team Leader)
            </h2>
            <span className="text-xs font-mono text-[#726C60]">Módulo de Gestión</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              href="/panel/gestion-campo/visitas"
              className="group block p-5 rounded-xl border transition-all hover:shadow-md hover:-translate-y-0.5"
              style={{ backgroundColor: TOKENS.canvas, borderColor: TOKENS.line }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl">📊</span>
                <StatusStamp tone="frio" size="sm">
                  TIEMPO REAL
                </StatusStamp>
              </div>
              <h3 className="text-lg font-bold uppercase tracking-wide group-hover:text-[#8B2635] transition-colors ft-display">
                Resumen & Presentismo
              </h3>
              <p className="text-xs text-[#726C60] mt-1 line-clamp-2">
                Panel central de asistencia, rutas en curso, porcentaje de avance y auditoría de colaboradores.
              </p>
            </Link>

            <Link
              href="/panel/gestion-campo/novedades"
              className="group block p-5 rounded-xl border transition-all hover:shadow-md hover:-translate-y-0.5"
              style={{ backgroundColor: TOKENS.canvas, borderColor: TOKENS.line }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl">⚠️</span>
                <StatusStamp tone="alerta" size="sm">
                  INCIDENCIAS
                </StatusStamp>
              </div>
              <h3 className="text-lg font-bold uppercase tracking-wide group-hover:text-[#8B2635] transition-colors ft-display">
                Gestión de Novedades
              </h3>
              <p className="text-xs text-[#726C60] mt-1 line-clamp-2">
                Recepción, resolución y trazabilidad de quiebres de stock, faltas y bloqueos reportados por impulsadores.
              </p>
            </Link>

            <Link
              href="/panel/gestion-campo/avisos"
              className="group block p-5 rounded-xl border transition-all hover:shadow-md hover:-translate-y-0.5"
              style={{ backgroundColor: TOKENS.canvas, borderColor: TOKENS.line }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl">📢</span>
                <StatusStamp tone="fresco" size="sm">
                  COMUNICADOS
                </StatusStamp>
              </div>
              <h3 className="text-lg font-bold uppercase tracking-wide group-hover:text-[#8B2635] transition-colors ft-display">
                Canal de Avisos
              </h3>
              <p className="text-xs text-[#726C60] mt-1 line-clamp-2">
                Emisión de directivas y recordatorios urgentes al equipo completo o a colaboradores puntuales con acuse de recibo.
              </p>
            </Link>
          </div>
        </div>
      )}

      {/* Acceso Rápido: Impulsador / Operación de Campo */}
      {tieneMiJornada && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#726C60]">
              Operación Diaria en Puntos de Venta (Impulsador)
            </h2>
            <span className="text-xs font-mono text-[#726C60]">Mi Jornada</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Link
              href="/panel/mi-jornada/locales"
              className="group block p-5 rounded-xl border transition-all hover:shadow-md hover:-translate-y-0.5"
              style={{ backgroundColor: TOKENS.canvas, borderColor: TOKENS.line }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl">📍</span>
                <StatusStamp tone="frio" size="sm">
                  HOY
                </StatusStamp>
              </div>
              <h3 className="text-lg font-bold uppercase tracking-wide group-hover:text-[#8B2635] transition-colors ft-display">
                Ruta de Locales
              </h3>
              <p className="text-xs text-[#726C60] mt-1 line-clamp-2">
                Lista ordenada de supermercados, carnicerías y puntos de venta con Check-in/out GPS.
              </p>
            </Link>

            <Link
              href="/panel/mi-jornada/tareas"
              className="group block p-5 rounded-xl border transition-all hover:shadow-md hover:-translate-y-0.5"
              style={{ backgroundColor: TOKENS.canvas, borderColor: TOKENS.line }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl">📋</span>
                <StatusStamp tone="carne" size="sm">
                  CHECKLIST
                </StatusStamp>
              </div>
              <h3 className="text-lg font-bold uppercase tracking-wide group-hover:text-[#8B2635] transition-colors ft-display">
                Tareas & Fotos
              </h3>
              <p className="text-xs text-[#726C60] mt-1 line-clamp-2">
                Cumplimiento por categoría (Limpieza, Góndola, Precios) con validación fotográfica antes/después.
              </p>
            </Link>

            <Link
              href="/panel/mi-jornada/novedades"
              className="group block p-5 rounded-xl border transition-all hover:shadow-md hover:-translate-y-0.5"
              style={{ backgroundColor: TOKENS.canvas, borderColor: TOKENS.line }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl">⚠️</span>
                <StatusStamp tone="alerta" size="sm">
                  NOTIFICAR
                </StatusStamp>
              </div>
              <h3 className="text-lg font-bold uppercase tracking-wide group-hover:text-[#8B2635] transition-colors ft-display">
                Reportar Novedad
              </h3>
              <p className="text-xs text-[#726C60] mt-1 line-clamp-2">
                Informar inmediatamente a tu supervisor sobre incidencias, locales cerrados o quiebre de stock.
              </p>
            </Link>

            <Link
              href="/panel/mi-jornada/avisos"
              className="group block p-5 rounded-xl border transition-all hover:shadow-md hover:-translate-y-0.5"
              style={{ backgroundColor: TOKENS.canvas, borderColor: TOKENS.line }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl">📬</span>
                <StatusStamp tone="fresco" size="sm">
                  MENSAJES
                </StatusStamp>
              </div>
              <h3 className="text-lg font-bold uppercase tracking-wide group-hover:text-[#8B2635] transition-colors ft-display">
                Avisos del Líder
              </h3>
              <p className="text-xs text-[#726C60] mt-1 line-clamp-2">
                Bandeja de directivas recibidas y confirmación de lectura para mantener alineado al equipo.
              </p>
            </Link>
          </div>
        </div>
      )}

      {modulos.length === 0 && (
        <div className="rounded-xl border border-dashed border-line bg-surface-raised p-6 text-sm text-muted">
          Todavía no hay módulos asignados a tu empresa.
        </div>
      )}
    </div>
  );
}
