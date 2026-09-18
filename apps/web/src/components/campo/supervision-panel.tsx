"use client";

import React, { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { mensajeError } from "@/utils/error";
import { fechaEnZonaIso } from "@/utils/fechas";
import { TOKENS } from "./tokens";
import { StatusStamp } from "./ui/status-stamp";
import { StatChip } from "./ui/stat-chip";
import { BigProgress } from "./ui/big-progress";
import { SegTabs } from "./ui/seg-tabs";
import { TopBar } from "./ui/top-bar";
import { BottomNav } from "./ui/bottom-nav";
import { CollaboratorRow } from "./ui/collaborator-row";
import {
  SelectorFechaFiltro,
  type PeriodoFiltro,
} from "./ui/selector-fecha-filtro";
import { PantallaCarga } from "@/components/pantalla-carga";
import { Modal } from "@/components/modal";
import type {
  ColaboradorDetalleData,
  SupervisionResumenData,
} from "@/types/campo";

// Iconos SVG reutilizables
const UsersIcon = ({
  size = 16,
  color = "currentColor",
}: {
  size?: number;
  color?: string;
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="9" cy="8" r="3" />
    <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
    <circle cx="17.5" cy="9" r="2.4" />
    <path d="M15.2 14.3c2.5.5 4.3 2.7 4.8 5.7" />
  </svg>
);

const NavigationIcon = ({
  size = 16,
  color = "currentColor",
}: {
  size?: number;
  color?: string;
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polygon points="12 2 19 21 12 17 5 21 12 2" />
  </svg>
);

const ListChecksIcon = ({
  size = 16,
  color = "currentColor",
}: {
  size?: number;
  color?: string;
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="3 6 4.5 7.5 7.5 4.5" />
    <line x1="11" y1="6" x2="21" y2="6" />
    <polyline points="3 13 4.5 14.5 7.5 11.5" />
    <line x1="11" y1="13" x2="21" y2="13" />
    <polyline points="3 19.5 4.5 21 7.5 18" />
    <line x1="11" y1="19.5" x2="21" y2="19.5" />
  </svg>
);

const AlertOctagonIcon = ({
  size = 16,
  color = "currentColor",
}: {
  size?: number;
  color?: string;
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const StoreIcon = ({
  size = 16,
  color = "currentColor",
}: {
  size?: number;
  color?: string;
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 10 5 4h14l1 6" />
    <rect x="4" y="10" width="16" height="10" rx="1" />
    <line x1="9" y1="20" x2="9" y2="14" />
    <line x1="15" y1="14" x2="15" y2="20" />
  </svg>
);

type TabType = "resumen" | "rutas" | "tareas";

interface SupervisionPanelProps {
  initialTab?: TabType;
}

export function SupervisionPanel({
  initialTab = "resumen",
}: SupervisionPanelProps) {
  const [tab, setTab] = useState<TabType>(initialTab);

  // Selector de período con fechas predefinidas y calendario
  const hoyStr = fechaEnZonaIso(new Date());
  const [periodo, setPeriodo] = useState<PeriodoFiltro>({
    clave: "hoy",
    etiqueta: "Hoy",
    fecha: hoyStr,
    fechaInicio: hoyStr,
    fechaFin: hoyStr,
  });

  const [resumen, setResumen] = useState<SupervisionResumenData | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Colaborador seleccionado para inspección detallada
  const [colaboradorId, setColaboradorId] = useState<number | null>(null);
  const [detalleColab, setDetalleColab] =
    useState<ColaboradorDetalleData | null>(null);
  const [subTabColab, setSubTabColab] = useState<
    "ruta" | "tareas" | "novedades"
  >("ruta");
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  // Cargar resumen de supervisión según el período seleccionado
  const cargarResumen = async () => {
    try {
      setCargando(true);
      setError(null);
      let query = "";
      if (periodo.fechaInicio && periodo.fechaFin) {
        query = `?fechaInicio=${periodo.fechaInicio}&fechaFin=${periodo.fechaFin}`;
      } else if (periodo.fecha) {
        query = `?fecha=${periodo.fecha}`;
      }
      const data = await apiFetch<SupervisionResumenData>(
        `/campo/supervision/resumen${query}`,
      );
      setResumen(data);
    } catch (e) {
      setError(mensajeError(e, "Error al cargar datos de supervisión"));
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    void Promise.resolve().then(cargarResumen);
  }, [periodo]);

  // Cargar detalle de colaborador
  const abrirColaborador = async (
    id: number,
    sub: "ruta" | "tareas" | "novedades" = "ruta",
  ) => {
    setColaboradorId(id);
    setSubTabColab(sub);
    try {
      setCargandoDetalle(true);
      const queryFecha = periodo.fecha ?? periodo.fechaInicio ?? hoyStr;
      const data = await apiFetch<ColaboradorDetalleData>(
        `/campo/supervision/colaboradores/${id}?fecha=${queryFecha}`,
      );
      setDetalleColab(data);
    } catch (e) {
      alert("Error al cargar detalle del colaborador: " + mensajeError(e, "Error inesperado"));
      setColaboradorId(null);
    } finally {
      setCargandoDetalle(false);
    }
  };

  const navItems = [
    { key: "resumen" as TabType, label: "Resumen Operativo", icon: UsersIcon },
    {
      key: "rutas" as TabType,
      label: "Rutas de Locales",
      icon: NavigationIcon,
    },
    {
      key: "tareas" as TabType,
      label: "Cumplimiento de Tareas",
      icon: ListChecksIcon,
    },
  ];

  return (
    <div
      className="campo-screen flex min-h-[calc(100vh-5rem)] w-full flex-col overflow-hidden font-sans"
      style={{
        background: TOKENS.bone,
        color: TOKENS.ink,
      }}
    >
      <TopBar
        title="Presencias del equipo"
        subtitle="Presentismo, rutas y tareas de los impulsadores"
        right={<SelectorFechaFiltro valorActual={periodo} onChange={setPeriodo} />}
      />

      {/* Selector de pestañas superiores (Desktop & Tablet) */}
      <div className="hidden gap-1 overflow-x-auto border-b border-line bg-surface-raised px-4 py-1 sm:flex sm:px-8">
        {navItems.map((it) => {
          const isActive = tab === it.key;
          const Icon = it.icon;
          return (
            <button
              key={it.key}
              onClick={() => setTab(it.key)}
              aria-pressed={isActive}
              className={`ft-body flex min-h-11 items-center gap-2 whitespace-nowrap border-b-2 px-3 text-sm font-medium transition-colors hover:bg-surface-soft ${
                isActive
                  ? "border-accent-ink text-foreground"
                  : "border-transparent text-muted"
              }`}
            >
              <span aria-hidden="true"><Icon size={16} color="currentColor" /></span>
              <span>{it.label}</span>
            </button>
          );
        })}
      </div>

      {/* Contenedor Principal Amplio (sin marco móvil, full-width responsive) */}
      <div
        className="flex-1 flex flex-col overflow-hidden w-full"
        style={{ background: TOKENS.bone }}
      >
        {cargando && !resumen ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12">
            <PantallaCarga
              visible
              mensaje="Cargando información operativa del equipo..."
            />
          </div>
        ) : error ? (
          <div className="p-6 m-6 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm max-w-2xl mx-auto w-full">
            <p className="font-bold text-base">
              No se pudieron cargar los datos de supervisión
            </p>
            <p className="mt-1 text-xs sm:text-sm">{error}</p>
            <button
              onClick={cargarResumen}
              className="mt-4 px-4 py-2 rounded-xl bg-red-600 text-white text-xs sm:text-sm font-semibold hover:bg-red-700 transition cursor-pointer"
            >
              Reintentar
            </button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto flex flex-col">
            {/* ==================== TAB 1: RESUMEN OPERATIVO ==================== */}
            {tab === "resumen" && resumen && (
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 flex-1 w-full">
                {/* Tarjetas de Métricas de Presentismo */}
                <div>
                  <p
                    className="ft-display text-2xl sm:text-3xl tracking-wide font-black mb-4"
                    style={{ color: TOKENS.ink }}
                  >
                    Presentismo
                  </p>
                  <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 mb-6 sm:grid sm:grid-cols-4 sm:overflow-visible">
                    <div className="min-w-[8.25rem] flex-1"><StatChip
                      label="En ruta activa"
                      value={resumen.presentismo.enRuta}
                      tone="frio"
                      sub="Con Check-In"
                    /></div>
                    <div className="min-w-[8.25rem] flex-1"><StatChip
                      label="Jornada finalizada"
                      value={resumen.presentismo.finalizados}
                      tone="fresco"
                      sub="Check-Out cerrado"
                    /></div>
                    <div className="min-w-[8.25rem] flex-1"><StatChip
                      label="Sin iniciar aún"
                      value={resumen.presentismo.sinIniciar}
                      tone="alerta"
                      sub="Pendientes de ingreso"
                    /></div>
                    <div className="min-w-[8.25rem] flex-1"><StatChip
                      label="Total Colaboradores"
                      value={resumen.presentismo.totalEquipo}
                      tone="ink"
                      sub="Plantel asignado"
                    /></div>
                  </div>

                  {/* Barras de avance globales de Rutas y Tareas */}
                  <div className="grid grid-cols-2 gap-2 sm:gap-5 mb-8">
                    <div
                      className="rounded-2xl p-3 sm:p-6 transition-all shadow-sm bg-surface-raised"
                      style={{ border: `1px solid ${TOKENS.line}` }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="ft-body text-xs sm:text-base font-bold text-foreground">
                          Rutas
                        </p>
                        <span className="ft-mono text-xs sm:text-sm font-extrabold px-3 py-1 rounded-lg bg-blue-50 text-blue-800 border border-blue-200">
                          {resumen.rutas.completadas} / {resumen.rutas.total}{" "}
                          paradas
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between mb-3">
                        <p
                          className="ft-display text-4xl font-black"
                          style={{ color: TOKENS.frio }}
                        >
                          {resumen.rutas.pct}%
                        </p>
                        <span className="ft-body text-xs sm:text-sm font-medium text-muted">
                          {resumen.rutas.enCurso} paradas en curso
                        </span>
                      </div>
                      <BigProgress
                        pct={resumen.rutas.pct}
                        color={TOKENS.frio}
                      />
                    </div>

                    <div
                      className="rounded-2xl p-4 sm:p-5 transition-all shadow-sm"
                      style={{
                        background: TOKENS.canvas,
                        border: `1px solid ${TOKENS.line}`,
                      }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p
                          className="ft-body text-xs sm:text-sm font-semibold"
                          style={{ color: TOKENS.sub }}
                        >
                          Tareas
                        </p>
                        <span className="ft-mono text-xs font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {resumen.tareas.completadas} / {resumen.tareas.total}{" "}
                          tareas
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between mb-2">
                        <p
                          className="ft-display text-3xl font-bold"
                          style={{ color: TOKENS.fresco }}
                        >
                          {resumen.tareas.pct}%
                        </p>
                        {resumen.tareas.obligatoriasPendientes > 0 && (
                          <span className="ft-body text-xs font-bold text-red-600 flex items-center gap-1">
                            <AlertOctagonIcon
                              size={13}
                              color={TOKENS.critico}
                            />
                            {resumen.tareas.obligatoriasPendientes} obligatorias
                            pendientes
                          </span>
                        )}
                      </div>
                      <BigProgress
                        pct={resumen.tareas.pct}
                        color={TOKENS.fresco}
                      />
                    </div>
                  </div>
                </div>

                {/* Lista de Colaboradores */}
                <div>
                  {resumen.colaboradores.length === 0 ? (
                    <div
                      className="rounded-2xl p-12 text-center bg-surface-raised"
                      style={{ border: `1px solid ${TOKENS.line}` }}
                    >
                      <p className="ft-body text-base text-muted font-medium">
                        No hay colaboradores asignados a tu equipo en el período
                        seleccionado.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {resumen.colaboradores.map((colab) => (
                        <CollaboratorRow
                          key={colab.id}
                          colaborador={colab}
                          metric="presentismo"
                          onOpen={() => abrirColaborador(colab.id, "ruta")}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ==================== TAB 2: RUTAS DEL EQUIPO ==================== */}
            {tab === "rutas" && resumen && (
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 flex-1 w-full">
                <TopBar
                  title="Avance de Rutas de Locales"
                  subtitle="Monitoreo en tiempo real de visitas a locales asignados, paradas completadas y en curso"
                />

                {/* Resumen Global de Rutas */}
                <div
                  className="rounded-2xl p-5 shadow-sm"
                  style={{
                    background: TOKENS.canvas,
                    border: `1px solid ${TOKENS.line}`,
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p
                      className="ft-body text-xs sm:text-sm font-semibold"
                      style={{ color: TOKENS.sub }}
                    >
                      Cumplimiento global de visitas del equipo
                    </p>
                    <p
                      className="ft-display text-3xl font-bold"
                      style={{ color: TOKENS.frio }}
                    >
                      {resumen.rutas.pct}%
                    </p>
                  </div>
                  <BigProgress pct={resumen.rutas.pct} color={TOKENS.frio} />

                  <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t border-[#DAD5C9]/60 ft-mono text-xs text-muted">
                    <span>
                      Total asignado:{" "}
                      <b className="text-foreground">{resumen.rutas.total}</b>
                    </span>
                    <span>
                      <b style={{ color: TOKENS.fresco }}>
                        {resumen.rutas.completadas}
                      </b>{" "}
                      completadas
                    </span>
                    <span>
                      <b style={{ color: TOKENS.frio }}>
                        {resumen.rutas.enCurso}
                      </b>{" "}
                      en curso
                    </span>
                    <span>
                      <b className="text-amber-700">
                        {resumen.rutas.pendientes}
                      </b>{" "}
                      pendientes
                    </span>
                  </div>
                </div>

                {/* Desglose por Colaborador */}
                <div>
                  <p
                    className="ft-display text-xl tracking-wide font-bold mb-3"
                    style={{ color: TOKENS.ink }}
                  >
                    Rutas por colaborador
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                    {resumen.colaboradores.map((colab) => (
                      <CollaboratorRow
                        key={colab.id}
                        colaborador={colab}
                        metric="ruta"
                        onOpen={() => abrirColaborador(colab.id, "ruta")}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ==================== TAB 3: TAREAS DEL EQUIPO ==================== */}
            {tab === "tareas" && resumen && (
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 flex-1 w-full">
                <TopBar
                  title="Cumplimiento de Tareas"
                  subtitle="Seguimiento de tareas operativas, góndola, precios, limpieza y obligatorias por colaborador"
                />

                {/* Resumen Global de Tareas */}
                <div
                  className="rounded-2xl p-6 sm:p-7 shadow-sm bg-surface-raised"
                  style={{ border: `1px solid ${TOKENS.line}` }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <p className="ft-body text-sm sm:text-base font-bold text-foreground">
                      Cumplimiento global de tareas del equipo
                    </p>
                    <p
                      className="ft-display text-4xl font-black"
                      style={{ color: TOKENS.fresco }}
                    >
                      {resumen.tareas.pct}%
                    </p>
                  </div>
                  <BigProgress pct={resumen.tareas.pct} color={TOKENS.fresco} />

                  {resumen.tareas.obligatoriasPendientes > 0 && (
                    <p className="ft-body text-sm font-extrabold mt-4 pt-4 border-t border-[#DAD5C9]/60 flex items-center gap-2 text-red-600">
                      <AlertOctagonIcon size={16} color={TOKENS.critico} />
                      {resumen.tareas.obligatoriasPendientes} tareas
                      obligatorias pendientes de ejecución en el equipo
                    </p>
                  )}
                </div>

                {/* Desglose por Colaborador */}
                <div>
                  <p
                    className="ft-display text-xl tracking-wide font-bold mb-3"
                    style={{ color: TOKENS.ink }}
                  >
                    Tareas por colaborador
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                    {resumen.colaboradores.map((colab) => (
                      <CollaboratorRow
                        key={colab.id}
                        colaborador={colab}
                        metric="tareas"
                        onOpen={() => abrirColaborador(colab.id, "tareas")}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bottom Navigation para móviles */}
        <BottomNav
          items={navItems}
          active={tab}
          onChange={setTab}
          className="sm:hidden mt-auto"
        />
      </div>

      {/* ==================== MODAL DETALLE DE COLABORADOR ==================== */}
      {colaboradorId && detalleColab && (
        <Modal
          titulo={detalleColab.colaborador.nombre}
          abierto={!!colaboradorId}
          onCerrar={() => {
            setColaboradorId(null);
            setDetalleColab(null);
          }}
          ancho="lg"
        >
          <div className="space-y-4 -mt-1">
            {/* Header del colaborador */}
            <div className="flex items-center justify-between">
              <div>
                <p className="ft-body text-xs sm:text-sm text-muted font-medium">
                  {detalleColab.colaborador.zona} · Tel:{" "}
                  {detalleColab.colaborador.telefono}
                </p>
              </div>
              <StatusStamp
                tone={
                  detalleColab.colaborador.asistencia === "en_curso"
                    ? "frio"
                    : detalleColab.colaborador.asistencia === "finalizado"
                      ? "fresco"
                      : "critico"
                }
              >
                {detalleColab.colaborador.asistencia === "en_curso"
                  ? "EN RUTA"
                  : detalleColab.colaborador.asistencia === "finalizado"
                    ? "FINALIZADO"
                    : "SIN INICIAR"}
              </StatusStamp>
            </div>

            {/* Fila de Inicio / Fin de jornada */}
            <div
              className="rounded-xl p-3 flex items-center justify-between text-xs sm:text-sm"
              style={{
                background: TOKENS.canvas,
                border: `1px solid ${TOKENS.line}`,
              }}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-muted">Inicio:</span>
                <span className="ft-mono font-bold text-foreground">
                  {detalleColab.colaborador.inicioJornada ?? "—"}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-muted">Fin:</span>
                <span className="ft-mono font-bold text-foreground">
                  {detalleColab.colaborador.finJornada ??
                    (detalleColab.colaborador.asistencia === "en_curso"
                      ? "en curso"
                      : "—")}
                </span>
              </div>
            </div>

            {/* Pestañas de detalle: Ruta / Tareas / Novedades */}
            <SegTabs
              active={subTabColab}
              onChange={setSubTabColab}
              tabs={[
                {
                  key: "ruta",
                  label: `Ruta (${detalleColab.ruta.filter((r) => r.estado === "completado").length}/${detalleColab.ruta.length})`,
                  icon: NavigationIcon,
                },
                {
                  key: "tareas",
                  label: `Tareas (${detalleColab.tareasCategorias.reduce((a, c) => a + c.completadas, 0)}/${detalleColab.tareasCategorias.reduce((a, c) => a + c.total, 0)})`,
                  icon: ListChecksIcon,
                },
              ]}
            />

            {/* Contenido sub-tab: Ruta del Colaborador */}
            {subTabColab === "ruta" && (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {detalleColab.ruta.length === 0 ? (
                  <p className="text-xs text-muted text-center py-6">
                    Sin paradas asignadas
                  </p>
                ) : (
                  detalleColab.ruta.map((p, i) => (
                    <div
                      key={p.localId}
                      className="rounded-xl p-3 flex items-center justify-between gap-3 text-xs"
                      style={{
                        background: TOKENS.canvas,
                        border: `1px solid ${TOKENS.line}`,
                      }}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-zinc-200 text-foreground ft-mono font-bold text-[11px] flex items-center justify-center shrink-0">
                          {i + 1}
                        </span>
                        <div>
                          <p className="ft-body font-semibold text-foreground text-sm">
                            {p.local}
                          </p>
                          <p className="ft-mono text-[11px] text-muted">
                            Ventana: {p.ventana ?? "Sin franja"} · {p.cliente}
                          </p>
                        </div>
                      </div>
                      <StatusStamp
                        tone={
                          p.estado === "completado"
                            ? "fresco"
                            : p.estado === "en_curso"
                              ? "frio"
                              : "sub"
                        }
                      >
                        {p.estado.toUpperCase()}
                      </StatusStamp>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Contenido sub-tab: Tareas del Colaborador */}
            {subTabColab === "tareas" && (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {detalleColab.tareasCategorias.length === 0 ? (
                  <p className="text-xs text-muted text-center py-6">
                    Sin tareas registradas
                  </p>
                ) : (
                  detalleColab.tareasCategorias.map((cat) => (
                    <div
                      key={cat.categoria}
                      className="rounded-xl p-3 text-xs"
                      style={{
                        background: TOKENS.canvas,
                        border: `1px solid ${TOKENS.line}`,
                      }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="ft-body font-bold text-foreground text-sm">
                          {cat.categoria}
                        </span>
                        <span className="ft-mono text-xs font-semibold text-muted">
                          {cat.completadas} / {cat.total}
                        </span>
                      </div>
                      <BigProgress
                        pct={
                          cat.total
                            ? Math.round((cat.completadas / cat.total) * 100)
                            : 0
                        }
                        color={TOKENS.fresco}
                      />
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
