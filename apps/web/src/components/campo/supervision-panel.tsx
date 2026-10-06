"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { mensajeError } from "@/utils/error";
import { fechaEnZonaIso, queryFechasCampo } from "@/utils/fechas";
import { TOKENS } from "./tokens";
import { StatusStamp } from "./ui/status-stamp";
import { BigProgress } from "./ui/big-progress";
import { SegTabs } from "./ui/seg-tabs";
import { TopBar } from "./ui/top-bar";
import { BottomNav } from "./ui/bottom-nav";
import { AvancePresentismo, EquipoPresentismo, ResumenPresentismo } from "./presentismo-equipo";
import styles from "./presentismo.module.css";
import {
  SelectorFechaFiltro,
  type PeriodoFiltro,
} from "./ui/selector-fecha-filtro";
import { PantallaCarga } from "@/components/pantalla-carga";
import { obtenerUrlFoto } from "@/lib/api-tareas";
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

type TabType = "resumen" | "rutas" | "tareas";

interface SupervisionPanelProps {
  initialTab?: TabType;
}

function FotoEvidencia({ id, momento, tarea }: { id: number; momento: "ANTES" | "DESPUES"; tarea: string }) {
  const [noDisponible, setNoDisponible] = useState(false);
  const etiqueta = momento === "ANTES" ? "Antes" : "Después";
  if (noDisponible) {
    return <div className="flex min-h-32 min-w-0 flex-col items-center justify-center rounded-lg border border-dashed border-line p-2 text-center text-xs text-muted"><span>Foto {etiqueta.toLowerCase()} no disponible en el servidor</span><span className="mt-1 font-mono">#{id}</span></div>;
  }
  return (
    <a href={obtenerUrlFoto(id)} target="_blank" rel="noopener noreferrer" className="min-w-0 rounded-lg border border-line p-1 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600" aria-label={`Abrir foto ${etiqueta.toLowerCase()} de ${tarea}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={obtenerUrlFoto(id)} alt={`Foto ${etiqueta.toLowerCase()} de ${tarea}`} onError={() => setNoDisponible(true)} loading="lazy" className="h-28 w-full rounded object-cover" />
      <span className="block py-1 text-xs font-medium text-foreground">{etiqueta}</span>
    </a>
  );
}

export function SupervisionPanel({
  initialTab = "resumen",
}: SupervisionPanelProps) {
  const [tab, setTab] = useState<TabType>(initialTab);
  const [filtroEquipo, setFiltroEquipo] = useState("todos");
  const [actualizado, setActualizado] = useState<string | null>(null);
  const equipoRef = useRef<HTMLDivElement>(null);
  const peticionDetalle = useRef(0);
  const peticionResumen = useRef(0);

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

  // Cargar resumen de supervisión según el período seleccionado
  const cargarResumen = useCallback(async () => {
    const peticion = ++peticionResumen.current;
    try {
      setCargando(true);
      setError(null);
      const query = queryFechasCampo(periodo);
      const data = await apiFetch<SupervisionResumenData>(
        `/campo/supervision/resumen${query ? `?${query}` : ""}`,
      );
      if (peticion !== peticionResumen.current) return;
      setResumen(data);
      setActualizado(new Intl.DateTimeFormat("es-PY", { timeZone: "America/Asuncion", hour: "2-digit", minute: "2-digit" }).format(new Date()));
    } catch (e) {
      if (peticion === peticionResumen.current) setError(mensajeError(e, "Error al cargar datos de supervisión"));
    } finally {
      if (peticion === peticionResumen.current) setCargando(false);
    }
  }, [periodo]);

  useEffect(() => {
    void Promise.resolve().then(cargarResumen);
  }, [cargarResumen]);

  // Cargar detalle de colaborador
  const abrirColaborador = async (
    id: number,
    sub: "ruta" | "tareas" | "novedades" = "ruta",
  ) => {
    const peticion = ++peticionDetalle.current;
    setDetalleColab(null);
    setColaboradorId(id);
    setSubTabColab(sub);
    try {
      const queryFecha = queryFechasCampo(periodo) || `fecha=${hoyStr}`;
      const data = await apiFetch<ColaboradorDetalleData>(
        `/campo/supervision/colaboradores/${id}?${queryFecha}`,
      );
      if (peticion === peticionDetalle.current) setDetalleColab(data);
    } catch (e) {
      if (peticion === peticionDetalle.current) {
        setError(mensajeError(e, "No se pudo cargar la ficha del colaborador"));
        setColaboradorId(null);
      }
    }
  };

  const navItems = [
    { key: "resumen" as TabType, label: "Equipo", icon: UsersIcon },
    {
      key: "rutas" as TabType,
      label: "Locales",
      icon: NavigationIcon,
    },
    {
      key: "tareas" as TabType,
      label: "Tareas",
      icon: ListChecksIcon,
    },
  ];

  if (colaboradorId) {
    return (
      <div className="campo-screen min-h-[calc(100vh-5rem)] w-full bg-background text-foreground">
        <TopBar
          title={detalleColab?.colaborador.nombre ?? "Colaborador"}
          subtitle="Ruta, tareas, comentarios y fotos del período seleccionado"
          onBack={() => {
            peticionDetalle.current++;
            setColaboradorId(null);
            setDetalleColab(null);
          }}
        />
        <main className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          {!detalleColab ? (
            <PantallaCarga visible mensaje="Cargando ficha del colaborador…" />
          ) : (
          <div className="space-y-4">
            {/* Header del colaborador */}
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="ft-body text-xs sm:text-sm text-muted font-medium">
                  {detalleColab.colaborador.zona}
                </p>
                {detalleColab.colaborador.telefono && <a href={`tel:${detalleColab.colaborador.telefono.replace(/[^+\d]/g, "")}`}
                  className="mt-1 inline-flex min-h-11 items-center whitespace-nowrap text-sm text-accent-ink hover:underline"
                  aria-label={`Llamar a ${detalleColab.colaborador.nombre}`}>Llamar · {detalleColab.colaborador.telefono}</a>}
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
              className="rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm"
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
              <div className="space-y-2">
                {detalleColab.ruta.length === 0 ? (
                  <p className="text-xs text-muted text-center py-6">
                    Sin paradas asignadas
                  </p>
                ) : (
                  detalleColab.ruta.map((p, i) => (
                    <div
                      key={p.localId}
                      className="rounded-xl p-3 flex min-w-0 flex-wrap items-center justify-between gap-3 text-xs"
                      style={{
                        background: TOKENS.canvas,
                        border: `1px solid ${TOKENS.line}`,
                      }}
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-zinc-200 text-foreground ft-mono font-bold text-[11px] flex items-center justify-center shrink-0">
                          {i + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="ft-body break-words font-semibold text-foreground text-sm">
                            {p.local}
                          </p>
                          <p className="ft-mono break-words text-[11px] text-muted">
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
              <div className="space-y-3">
                {detalleColab.tareasCategorias.length === 0 && (detalleColab.evidencias ?? []).length === 0 ? (
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
                {(detalleColab.evidencias ?? []).length > 0 && (
                  <div className="space-y-3 border-t border-line pt-3">
                    <h3 className="text-sm font-semibold text-foreground">Detalle de visitas y evidencias</h3>
                    {(detalleColab.evidencias ?? []).map((evidencia) => (
                      <article key={`${evidencia.visitaId}-${evidencia.tareaId}`} className="min-w-0 space-y-2 rounded-xl border border-line bg-surface-raised p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h4 className="break-words text-sm font-semibold text-foreground">{evidencia.nombreTarea}</h4>
                            <p className="break-words text-xs text-muted">{evidencia.local} · {evidencia.cliente}</p>
                          </div>
                          <StatusStamp tone={evidencia.completadaAt ? "fresco" : "sub"} size="sm">{evidencia.completadaAt ? "COMPLETADA" : "EN CURSO"}</StatusStamp>
                        </div>
                        <p className="text-xs text-muted">Visita: {new Date(evidencia.entrada).toLocaleString("es-PY")} · Salida: {evidencia.salida ? new Date(evidencia.salida).toLocaleTimeString("es-PY") : "en curso"}</p>
                        {evidencia.completadaAt && <p className="text-xs text-muted">Completada: {new Date(evidencia.completadaAt).toLocaleString("es-PY")}</p>}
                        {evidencia.fotos.length > 0 && (
                          <div className="grid grid-cols-2 gap-2">
                            {evidencia.fotos.map((foto) => (
                              <FotoEvidencia key={foto.id} id={foto.id} momento={foto.momento} tarea={evidencia.nombreTarea} />
                            ))}
                          </div>
                        )}
                        {evidencia.comentarios.length > 0 && (
                          <div className="space-y-1 border-t border-line pt-2">
                            <p className="text-xs font-semibold text-foreground">Comentarios</p>
                            {evidencia.comentarios.map((comentario) => (
                              <p key={comentario.id} className="break-words text-xs text-muted"><strong>{comentario.usuario.nombre} {comentario.usuario.apellido}:</strong> {comentario.comentario}</p>
                            ))}
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          )}
        </main>
      </div>
    );
  }
  return (
    <div className={`campo-screen ${styles.screen}`}>
      <header className={styles.header}>
        <div><h1>Presentismo</h1><p>Equipo comercial · {resumen?.fecha ?? periodo.etiqueta}{actualizado ? ` · Actualizado ${actualizado}` : ""}</p></div>
        <div className={styles.toolbar}>
          <SelectorFechaFiltro valorActual={periodo} onChange={valor => { setPeriodo(valor); setFiltroEquipo("todos"); }} />
          <button type="button" className={styles.refresh} onClick={cargarResumen} disabled={cargando} aria-busy={cargando} aria-label="Actualizar presentismo" title="Actualizar presentismo">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6 7a7 7 0 0 1 12-1l2 6M4 12l2 6a7 7 0 0 0 12-1" /></svg>
          </button>
        </div>
      </header>

      {/* Selector de pestañas superiores (Desktop & Tablet) */}
      <div className={`${styles.desktopTabs} hidden gap-1 overflow-x-auto border-b border-line bg-surface-raised px-4 py-1 sm:flex sm:px-8`}>
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
        className="flex min-w-0 w-full flex-col"
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
          <div className="mx-auto my-4 w-[calc(100%-2rem)] max-w-2xl rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200" role="alert">
            <p className="font-bold text-base">
              No se pudieron cargar los datos de supervisión
            </p>
            <p className="mt-1 text-xs sm:text-sm">{error}</p>
            <button
              onClick={cargarResumen}
              className="mt-4 min-h-11 rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 dark:bg-red-800 dark:hover:bg-red-700"
            >
              Reintentar
            </button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto flex flex-col">
            {/* ==================== TAB 1: RESUMEN OPERATIVO ==================== */}
            {tab === "resumen" && resumen && (
              <div className={styles.body}>
                <ResumenPresentismo resumen={resumen} onPendientes={() => {
                  setFiltroEquipo("sin_iniciar");
                  equipoRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
                }} />
                <div ref={equipoRef} className={`${styles.teamColumn} min-w-0 scroll-mt-24`}>
                  <EquipoPresentismo key={resumen.fecha} colaboradores={resumen.colaboradores} filtro={filtroEquipo} onFiltro={setFiltroEquipo}
                    onOpen={id => void abrirColaborador(id, "ruta")} />
                </div>
                <AvancePresentismo resumen={resumen} />
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
                  <EquipoPresentismo key={resumen.fecha} colaboradores={resumen.colaboradores} metric="ruta"
                    filtro={filtroEquipo} onFiltro={setFiltroEquipo} onOpen={id => void abrirColaborador(id, "ruta")} />
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
                  <EquipoPresentismo key={resumen.fecha} colaboradores={resumen.colaboradores} metric="tareas"
                    filtro={filtroEquipo} onFiltro={setFiltroEquipo} onOpen={id => void abrirColaborador(id, "tareas")} />
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
          className="fixed inset-x-0 bottom-0 z-20 sm:hidden"
        />
      </div>
      <PantallaCarga visible={cargando && !!resumen} mensaje="Actualizando presentismo…" />
    </div>
  );
}
