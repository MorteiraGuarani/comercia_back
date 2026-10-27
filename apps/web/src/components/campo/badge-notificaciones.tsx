"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePanel } from "@/components/panel/contexto";
import { IconoMas } from "@/components/icono-mas";
import { ListaAvisosCampana, ListaNovedadesCampana } from "./campana-pestanas";
import {
  listarNotificaciones,
  marcarNotificacionLeida,
  marcarTodasNotificacionesLeidas,
  obtenerContadorNoLeidas,
} from "@/lib/api-tareas";
import type { Notificacion, TipoNotificacion } from "@/types/campo";
import { mostrarToast } from "@/components/toast/toast-controller";
import { Modal } from "@/components/modal";
import { Paginacion } from "@/components/paginacion";
import { HiloNovedad } from "./hilo-novedad";
import { DetalleAviso } from "./detalle-aviso";
import { DetalleNotificacionInventario } from "./detalle-notificacion-inventario";

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
    // Con la pestaña oculta no consulta; al volver, actualiza enseguida.
    const actualizar = () => {
      if (document.hidden) return;
      void obtenerContadorNoLeidas()
        .then((data) => {
          if (activo) setNoLeidas(data.noLeidas);
        })
        .catch(() => undefined);
    };
    actualizar();
    const interval = setInterval(actualizar, 30000);
    document.addEventListener("visibilitychange", actualizar);

    return () => {
      activo = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", actualizar);
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
    case "NOVEDAD_RESPUESTA":
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
    case "VENCIMIENTO_PROXIMO":
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
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18M12 14v3M12 20h.01" />
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
  const [referenciaSeleccionada, setReferenciaSeleccionada] = useState<{
    tipo: "novedad" | "aviso" | "inventario";
    id: number;
  } | null>(null);
  const [pestana, setPestana] = useState<
    "notificaciones" | "avisos" | "novedades"
  >("notificaciones");

  // Avisos y novedades salieron del menú: la campana es su acceso. Cada pestaña
  // aparece solo si el rol tiene la página; el líder redacta avisos y el
  // personal de campo reporta novedades.
  const { modulos } = usePanel();
  const router = useRouter();
  const tiene = (modulo: string, pagina: string) =>
    modulos.some(
      (m) => m.ruta === modulo && m.paginas.some((p) => p.ruta === pagina),
    );
  const avisosLider = tiene("gestion-campo", "avisos");
  const avisosCampo = tiene("mi-jornada", "avisos");
  const novedadesLider = tiene("gestion-campo", "novedades");
  const novedadesCampo = tiene("mi-jornada", "novedades");
  const rutaAvisos = avisosLider
    ? "/panel/gestion-campo/avisos"
    : avisosCampo
      ? "/panel/mi-jornada/avisos"
      : null;
  const rutaNovedades = novedadesLider
    ? "/panel/gestion-campo/novedades"
    : novedadesCampo
      ? "/panel/mi-jornada/novedades"
      : null;
  const pestanas = [
    { clave: "notificaciones" as const, etiqueta: "Notificaciones" },
    ...(rutaAvisos ? [{ clave: "avisos" as const, etiqueta: "Avisos" }] : []),
    ...(rutaNovedades
      ? [{ clave: "novedades" as const, etiqueta: "Novedades" }]
      : []),
  ];
  const crear =
    pestana === "avisos" && avisosLider
      ? {
          href: "/panel/gestion-campo/avisos?redactar=1",
          etiqueta: "Crear aviso",
        }
      : pestana === "novedades" && novedadesCampo
        ? {
            href: "/panel/mi-jornada/novedades?crear=1",
            etiqueta: "Crear novedad",
          }
        : null;
  const historial =
    pestana === "avisos" && rutaAvisos
      ? { href: rutaAvisos, etiqueta: "Ver historial de avisos" }
      : pestana === "novedades" && rutaNovedades
        ? { href: rutaNovedades, etiqueta: "Ver historial de novedades" }
        : null;

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
        prev.map((item) =>
          item.id === n.id ? { ...item, leido: true } : item,
        ),
      );
      await marcarNotificacionLeida(n.id);
      await cargarNotificaciones();
      onActualizado();
    } catch {
      mostrarToast("error", "Error al marcar como leída");
      cargarNotificaciones();
    }
  };

  const handleAbrirNotificacion = (n: Notificacion) => {
    if (n.tipo === "VENCIMIENTO_PROXIMO") {
      setReferenciaSeleccionada({ tipo: "inventario", id: n.id });
    } else if (n.referenciaId) {
      if (
        n.tipo === "NOVEDAD_CREADA" ||
        n.tipo === "NOVEDAD_ACTUALIZADA" ||
        n.tipo === "NOVEDAD_RESPUESTA"
      ) {
        setReferenciaSeleccionada({ tipo: "novedad", id: n.referenciaId });
      } else if (n.tipo === "AVISO_RECIBIDO") {
        setReferenciaSeleccionada({ tipo: "aviso", id: n.referenciaId });
      }
    }
    if (!n.leido) void handleMarcarLeida(n);
  };

  const handleMarcarTodasLeidas = async () => {
    if (marcandoTodas) return;
    setMarcandoTodas(true);
    try {
      const result = await marcarTodasNotificacionesLeidas();
      mostrarToast(
        "exito",
        `${result.marcadas} notificaciones marcadas como leídas`,
      );
      setNotificaciones((prev) =>
        prev.map((item) => ({ ...item, leido: true })),
      );
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
    <Modal
      titulo="Notificaciones"
      abierto
      onCerrar={onCerrar}
      ancho="lg"
      hojaMovil
      pie={
        referenciaSeleccionada ? undefined : pestana === "notificaciones" ? (
          totalItems > 0 ? (
            <Paginacion
              page={page}
              totalPages={totalPages}
              total={totalItems}
              limit={limit}
              onPageChange={setPage}
              onLimitChange={(cantidad) => {
                setLimit(cantidad);
                setPage(1);
              }}
              desplazarAlInicio={false}
            />
          ) : undefined
        ) : historial ? (
          <Link
            href={historial.href}
            onClick={onCerrar}
            className="mt-3 flex min-h-11 w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-line bg-surface-raised px-3 text-sm font-semibold text-foreground transition-colors hover:border-brand-500 hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            {historial.etiqueta}
            <span aria-hidden="true">→</span>
          </Link>
        ) : undefined
      }
    >
      {referenciaSeleccionada ? (
        <div className="min-w-0 space-y-4">
          <button
            type="button"
            onClick={() => setReferenciaSeleccionada(null)}
            className="min-h-11 cursor-pointer whitespace-nowrap rounded-lg border border-line px-3 text-sm font-semibold text-foreground transition-colors hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:border-line dark:text-foreground dark:hover:bg-surface-soft"
          >
            ← Volver
          </button>
          {referenciaSeleccionada.tipo === "inventario" ? (
            <DetalleNotificacionInventario
              key={referenciaSeleccionada.id}
              id={referenciaSeleccionada.id}
            />
          ) : referenciaSeleccionada.tipo === "novedad" ? (
            <HiloNovedad
              id={referenciaSeleccionada.id}
              onActualizado={() => void cargarNotificaciones()}
            />
          ) : (
            <DetalleAviso id={referenciaSeleccionada.id} />
          )}
        </div>
      ) : (
        <div className="flex min-w-0 flex-col space-y-3">
          {pestanas.length > 1 ? (
            <div className="flex min-w-0 items-center gap-2">
              <div
                role="tablist"
                aria-label="Secciones"
                className="flex min-w-0 flex-1 gap-1 rounded-lg bg-surface-soft p-1"
              >
                {pestanas.map((p) => (
                  <button
                    key={p.clave}
                    type="button"
                    role="tab"
                    aria-selected={pestana === p.clave}
                    onClick={() => setPestana(p.clave)}
                    className={`flex min-h-11 min-w-0 flex-1 cursor-pointer items-center justify-center gap-1 whitespace-nowrap rounded-md px-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                      pestana === p.clave
                        ? "bg-surface-raised text-foreground shadow-sm"
                        : "text-muted hover:bg-surface-raised/60 hover:text-foreground"
                    }`}
                  >
                    <span className="truncate">{p.etiqueta}</span>
                    {p.clave === "notificaciones" && noLeidas > 0 ? (
                      <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold text-white">
                        {noLeidas > 99 ? "99+" : noLeidas}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
              {crear ? (
                <Link
                  href={crear.href}
                  onClick={onCerrar}
                  aria-label={crear.etiqueta}
                  title={crear.etiqueta}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-brand-700 text-white shadow-sm transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus dark:bg-brand-500 dark:text-brand-950 dark:hover:brightness-110"
                >
                  <IconoMas className="h-5 w-5" />
                </Link>
              ) : null}
            </div>
          ) : null}

          {pestana === "avisos" ? (
            <ListaAvisosCampana
              esLider={avisosLider}
              onAbrir={(id) => setReferenciaSeleccionada({ tipo: "aviso", id })}
              onIrAlHistorial={() => {
                if (!rutaAvisos) return;
                onCerrar();
                router.push(rutaAvisos);
              }}
            />
          ) : pestana === "novedades" ? (
            <ListaNovedadesCampana
              esLider={novedadesLider}
              onAbrir={(id) =>
                setReferenciaSeleccionada({ tipo: "novedad", id })
              }
            />
          ) : (
            <div className="flex min-w-0 flex-col space-y-4">
              {/* Barra superior de filtros y acción "Marcar leídas" */}
              <div className="flex min-w-0 flex-col items-stretch gap-2 border-b border-line pb-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between dark:border-line">
                <div className="flex min-w-0 items-center gap-1.5 rounded-lg bg-surface-soft p-1 dark:bg-surface-soft">
                  <button
                    type="button"
                    onClick={() => {
                      setFiltro("todas");
                      setPage(1);
                    }}
                    aria-pressed={filtro === "todas"}
                    className={`min-h-11 flex-1 cursor-pointer whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 sm:flex-none ${
                      filtro === "todas"
                        ? "bg-surface-raised text-foreground shadow-sm dark:bg-surface-raised dark:text-foreground"
                        : "text-muted hover:bg-surface-raised hover:text-foreground dark:text-muted dark:hover:bg-surface-raised dark:hover:text-foreground"
                    }`}
                  >
                    Todas{" "}
                    {filtro === "todas" && totalItems > 0
                      ? `(${totalItems})`
                      : ""}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFiltro("no_leidas");
                      setPage(1);
                    }}
                    aria-pressed={filtro === "no_leidas"}
                    className={`flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 sm:flex-none ${
                      filtro === "no_leidas"
                        ? "bg-surface-raised text-foreground shadow-sm dark:bg-surface-raised dark:text-foreground"
                        : "text-muted hover:bg-surface-raised hover:text-foreground dark:text-muted dark:hover:bg-surface-raised dark:hover:text-foreground"
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
                  className="min-h-11 cursor-pointer whitespace-nowrap rounded-lg px-2 text-xs font-semibold text-brand-700 transition-colors hover:bg-surface-soft hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 disabled:cursor-not-allowed disabled:opacity-50 dark:text-brand-200 dark:hover:bg-surface-soft dark:hover:text-brand-100"
                >
                  {marcandoTodas ? "Marcando..." : "Marcar todas como leídas"}
                </button>
              </div>

              {/* Lista de Notificaciones */}
              <div className="min-w-0">
                {cargando ? (
                  <div className="py-12 text-center">
                    <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-brand-600 border-t-transparent dark:border-brand-500"></div>
                    <p className="mt-2 text-xs text-muted">
                      Cargando avisos...
                    </p>
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
                            const esNovedadActualizada =
                              n.tipo === "NOVEDAD_ACTUALIZADA";
                            const esNovedadRespuesta =
                              n.tipo === "NOVEDAD_RESPUESTA";
                            const esAviso = n.tipo === "AVISO_RECIBIDO";

                            const colorClase = esCompletada
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-800/40"
                              : esComentario
                                ? "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border-sky-200/60 dark:border-sky-800/40"
                                : esFoto
                                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200/60 dark:border-amber-800/40"
                                  : esNovedadCreada
                                    ? "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border-red-200/60 dark:border-red-800/40"
                                    : esNovedadActualizada || esNovedadRespuesta
                                      ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200/60 dark:border-indigo-800/40"
                                      : esAviso
                                        ? "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200/60 dark:border-purple-800/40"
                                        : "bg-surface-soft text-foreground border-line";

                            return (
                              <button
                                key={n.id}
                                type="button"
                                onClick={() => handleAbrirNotificacion(n)}
                                aria-label={
                                  n.leido
                                    ? `${n.titulo}. Abrir notificación`
                                    : `${n.titulo}. Abrir y marcar como leída`
                                }
                                className={`group flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-[background-color,border-color,box-shadow,opacity] ${
                                  !n.leido
                                    ? "border-line bg-surface-raised shadow-[0_2px_8px_rgba(var(--warm-shadow),0.06)] hover:border-brand-500/50 dark:hover:border-brand-500/40"
                                    : "border-line/60 bg-surface-soft/30 opacity-80 hover:bg-surface-soft"
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

                                  <div className="mt-2 flex min-w-0 flex-col items-start gap-1 border-t border-line/40 pt-1.5 text-[11px] text-muted sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                                    <span className="flex min-w-0 max-w-full items-center gap-1 truncate">
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
                                      {n.usuarioEmisor.nombre}{" "}
                                      {n.usuarioEmisor.apellido}
                                    </span>

                                    <span className="shrink-0 whitespace-nowrap font-mono text-[10px] text-muted">
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
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
