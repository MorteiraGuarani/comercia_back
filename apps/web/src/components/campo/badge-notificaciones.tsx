"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  listarNotificaciones,
  marcarNotificacionLeida,
  marcarTodasNotificacionesLeidas,
  obtenerContadorNoLeidas,
} from "@/lib/api-tareas";
import type { Notificacion, TipoNotificacion } from "@/types/campo";
import { mostrarToast } from "@/components/toast/toast-controller";
import { Modal } from "@/components/modal";

export function BadgeNotificaciones() {
  const [noLeidas, setNoLeidas] = useState(0);
  const [mostrarPanel, setMostrarPanel] = useState(false);

  const refrescarContador = useCallback(() => {
    void obtenerContadorNoLeidas()
      .then((data) => {
        setNoLeidas(data.noLeidas);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    let activo = true;
    void obtenerContadorNoLeidas()
      .then((data) => {
        if (activo) setNoLeidas(data.noLeidas);
      })
      .catch(() => undefined);

    const interval = setInterval(() => {
      void obtenerContadorNoLeidas()
        .then((data) => {
          if (activo) setNoLeidas(data.noLeidas);
        })
        .catch(() => undefined);
    }, 30000);

    return () => {
      activo = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setMostrarPanel(true)}
        className="relative grid h-10 w-10 place-items-center rounded-xl border border-transparent text-muted transition hover:border-line hover:bg-surface-soft hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand-600/40"
        aria-label={`Notificaciones${noLeidas > 0 ? ` (${noLeidas} sin leer)` : ""}`}
        title="Notificaciones"
      >
        <svg
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>

        {noLeidas > 0 && (
          <span
            className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white shadow-sm ring-2 ring-surface-raised dark:bg-red-500"
            aria-hidden="true"
          >
            {noLeidas > 99 ? "99+" : noLeidas}
          </span>
        )}
      </button>

      {mostrarPanel && (
        <PanelNotificaciones
          noLeidas={noLeidas}
          onCerrar={() => {
            setMostrarPanel(false);
            refrescarContador();
          }}
          onActualizado={refrescarContador}
        />
      )}
    </>
  );
}

interface PanelNotificacionesProps {
  noLeidas: number;
  onCerrar: () => void;
  onActualizado: () => void;
}

function IconoTipo({ tipo }: { tipo: TipoNotificacion }) {
  switch (tipo) {
    case "COMENTARIO_TAREA":
      return (
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
    case "TAREA_COMPLETADA":
      return (
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      );
    case "FOTO_SUBIDA":
      return (
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
      );
    case "NOVEDAD_CREADA":
      return (
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      );
    case "NOVEDAD_ACTUALIZADA":
      return (
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case "AVISO_RECIBIDO":
      return (
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
        </svg>
      );
    default:
      return (
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      );
  }
}

function obtenerGrupoFecha(fechaIso: string): string {
  const fecha = new Date(fechaIso);
  const ahora = new Date();

  const esMismoDia = (d1: Date, d2: Date) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  if (esMismoDia(fecha, ahora)) return "Hoy";

  const ayer = new Date(ahora);
  ayer.setDate(ayer.getDate() - 1);
  if (esMismoDia(fecha, ayer)) return "Ayer";

  const hace7Dias = new Date(ahora);
  hace7Dias.setDate(hace7Dias.getDate() - 7);
  if (fecha >= hace7Dias) return "Esta semana";

  return "Anteriores";
}

function formatearHoraOFecha(fechaIso: string): string {
  const fecha = new Date(fechaIso);
  const ahora = new Date();
  const esHoy =
    fecha.getFullYear() === ahora.getFullYear() &&
    fecha.getMonth() === ahora.getMonth() &&
    fecha.getDate() === ahora.getDate();

  if (esHoy) {
    return fecha.toLocaleTimeString("es-PY", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return fecha.toLocaleDateString("es-PY", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function PanelNotificaciones({
  noLeidas,
  onCerrar,
  onActualizado,
}: PanelNotificacionesProps) {
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(7);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [filtro, setFiltro] = useState<"todas" | "no_leidas">("todas");
  const [marcandoTodas, setMarcandoTodas] = useState(false);

  const cargarNotificaciones = useCallback(async () => {
    setCargando(true);
    try {
      const data = await listarNotificaciones(
        page,
        limit,
        filtro === "no_leidas" ? false : undefined,
      );
      setNotificaciones(data.items);
      setTotalPages(data.totalPages);
      setTotalItems(data.total);
    } catch {
      mostrarToast("error", "Error al cargar notificaciones");
    } finally {
      setCargando(false);
    }
  }, [page, limit, filtro]);

  useEffect(() => {
    let activo = true;
    void listarNotificaciones(
      page,
      limit,
      filtro === "no_leidas" ? false : undefined,
    )
      .then((data) => {
        if (activo) {
          setNotificaciones(data.items);
          setTotalPages(data.totalPages);
          setTotalItems(data.total);
        }
      })
      .catch(() => {
        if (activo) mostrarToast("error", "Error al cargar notificaciones");
      })
      .finally(() => {
        if (activo) setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, [page, limit, filtro]);

  const handleMarcarLeida = async (n: Notificacion) => {
    if (n.leido) return;
    try {
      // Optimistic update
      setNotificaciones((prev) =>
        prev.map((item) => (item.id === n.id ? { ...item, leido: true } : item)),
      );
      await marcarNotificacionLeida(n.id);
      await cargarNotificaciones();
      onActualizado();
    } catch {
      mostrarToast("error", "Error al marcar como leída");
      cargarNotificaciones();
    }
  };

  const handleMarcarTodasLeidas = async () => {
    if (marcandoTodas) return;
    setMarcandoTodas(true);
    try {
      const result = await marcarTodasNotificacionesLeidas();
      mostrarToast("exito", `${result.marcadas} notificaciones marcadas como leídas`);
      setNotificaciones((prev) => prev.map((item) => ({ ...item, leido: true })));
      onActualizado();
      await cargarNotificaciones();
    } catch {
      mostrarToast("error", "Error al marcar todas como leídas");
    } finally {
      setMarcandoTodas(false);
    }
  };

  // Agrupamiento por período (Hoy, Ayer, Esta semana, Anteriores)
  const grupos = useMemo(() => {
    const orden = ["Hoy", "Ayer", "Esta semana", "Anteriores"];
    const mapa: Record<string, Notificacion[]> = {};

    for (const n of notificaciones) {
      const grupo = obtenerGrupoFecha(n.creadoAt);
      if (!mapa[grupo]) mapa[grupo] = [];
      mapa[grupo].push(n);
    }

    return orden
      .filter((g) => mapa[g] && mapa[g].length > 0)
      .map((g) => ({ nombre: g, items: mapa[g] }));
  }, [notificaciones]);

  return (
    <Modal titulo="Avisos y Notificaciones" abierto onCerrar={onCerrar} ancho="lg">
      <div className="flex flex-col space-y-4">
        {/* Barra superior de filtros y acción "Marcar leídas" */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
          <div className="flex items-center gap-1.5 rounded-lg bg-surface-soft p-1">
            <button
              type="button"
              onClick={() => {
                setFiltro("todas");
                setPage(1);
              }}
              aria-pressed={filtro === "todas"}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                filtro === "todas"
                  ? "bg-surface-raised text-foreground shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              Todas {filtro === "todas" && totalItems > 0 ? `(${totalItems})` : ""}
            </button>
            <button
              type="button"
              onClick={() => {
                setFiltro("no_leidas");
                setPage(1);
              }}
              aria-pressed={filtro === "no_leidas"}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                filtro === "no_leidas"
                  ? "bg-surface-raised text-foreground shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <span>No leídas</span>
              {noLeidas > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold text-white">
                  {noLeidas > 99 ? "99+" : noLeidas}
                </span>
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={handleMarcarTodasLeidas}
            disabled={marcandoTodas || noLeidas === 0}
            className="text-xs font-semibold text-brand-700 hover:text-brand-800 disabled:opacity-40 dark:text-brand-400 dark:hover:text-brand-300 transition-colors"
          >
            {marcandoTodas ? "Marcando..." : "Marcar todas como leídas"}
          </button>
        </div>

        {/* Lista de Notificaciones */}
        <div className="max-h-[60vh] overflow-y-auto pr-1">
          {cargando ? (
            <div className="py-12 text-center">
              <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-brand-600 border-t-transparent dark:border-brand-400"></div>
              <p className="mt-2 text-xs text-muted">Cargando avisos...</p>
            </div>
          ) : notificaciones.length === 0 ? (
            <div className="py-12 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-surface-soft text-muted">
                <svg
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth="1.8"
                  aria-hidden="true"
                >
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              </div>
              <p className="mt-3 text-sm font-semibold text-foreground">
                {filtro === "no_leidas"
                  ? "No tenés avisos pendientes"
                  : "No hay notificaciones"}
              </p>
              <p className="mt-1 text-xs text-muted">
                {filtro === "no_leidas"
                  ? "Todo al día en tus locales, tareas y equipo."
                  : "Las novedades de tu operación aparecerán aquí."}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {grupos.map((grupo) => (
                <div key={grupo.nombre}>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">
                    {grupo.nombre}
                  </p>
                  <div className="space-y-2">
                    {grupo.items.map((n) => {
                      const esComentario = n.tipo === "COMENTARIO_TAREA";
                      const esCompletada = n.tipo === "TAREA_COMPLETADA";
                      const esFoto = n.tipo === "FOTO_SUBIDA";
                      const esNovedadCreada = n.tipo === "NOVEDAD_CREADA";
                      const esNovedadActualizada = n.tipo === "NOVEDAD_ACTUALIZADA";
                      const esAviso = n.tipo === "AVISO_RECIBIDO";

                      const colorClase = esCompletada
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-800/40"
                        : esComentario
                          ? "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border-sky-200/60 dark:border-sky-800/40"
                          : esFoto
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200/60 dark:border-amber-800/40"
                            : esNovedadCreada
                              ? "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border-red-200/60 dark:border-red-800/40"
                              : esNovedadActualizada
                                ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200/60 dark:border-indigo-800/40"
                                : esAviso
                                  ? "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200/60 dark:border-purple-800/40"
                                  : "bg-surface-soft text-foreground border-line";

                      return (
                        <button
                          key={n.id}
                          type="button"
                          disabled={n.leido}
                          onClick={() => void handleMarcarLeida(n)}
                          aria-label={
                            n.leido
                              ? `${n.titulo}. Notificación leída`
                              : `${n.titulo}. Marcar como leída`
                          }
                          className={`group flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-[background-color,border-color,box-shadow,opacity] ${
                            !n.leido
                              ? "border-line bg-surface-raised shadow-[0_2px_8px_rgba(var(--warm-shadow),0.06)] hover:border-brand-500/50 dark:hover:border-brand-500/40"
                              : "border-line/60 bg-surface-soft/30 opacity-80 disabled:cursor-default"
                          }`}
                        >
                          {/* Ícono temático en avatar circular */}
                          <div
                            className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border ${colorClase}`}
                          >
                            <IconoTipo tipo={n.tipo} />
                          </div>

                          {/* Contenido */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="truncate text-sm font-semibold text-foreground">
                                {n.titulo}
                              </p>
                              {!n.leido && (
                                <span
                                  className="h-2 w-2 shrink-0 rounded-full bg-red-600 dark:bg-red-500"
                                  title="No leída"
                                  aria-label="No leída"
                                />
                              )}
                            </div>

                            <p className="mt-0.5 text-xs text-muted leading-relaxed break-words">
                              {n.mensaje}
                            </p>

                            <div className="mt-2 flex items-center justify-between gap-2 border-t border-line/40 pt-1.5 text-[11px] text-muted">
                              <span className="flex items-center gap-1 truncate">
                                <svg
                                  className="h-3 w-3 shrink-0"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                  strokeWidth="2"
                                  aria-hidden="true"
                                >
                                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                  <circle cx="12" cy="7" r="4" />
                                </svg>
                                {n.usuarioEmisor.nombre} {n.usuarioEmisor.apellido}
                              </span>

                              <span className="font-mono text-[10px] text-muted shrink-0">
                                {formatearHoraOFecha(n.creadoAt)}
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Paginación */}
        {totalItems > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-xs">
            <label className="flex items-center gap-1.5 text-muted">
              Por pagina
              <select
                aria-label="Registros por pagina"
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="min-h-9 rounded-lg border border-line bg-surface-raised px-2 text-xs text-foreground"
              >
                {[7, 15, 30].map((opcion) => (
                  <option key={opcion} value={opcion}>
                    {opcion}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg border border-line px-3 py-1.5 font-medium transition-colors hover:bg-surface-soft disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Anterior
            </button>
            <span className="text-muted">
              Página {page} de {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-lg border border-line px-3 py-1.5 font-medium transition-colors hover:bg-surface-soft disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Siguiente
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
