"use client";
import type { PeriodoFiltro } from "@/types/periodo-filtro";

import Link from "next/link";
import { PRESENTISMO, RUTA } from "@/utils/estado-jornada";

import React, { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { apiFetch } from "@/lib/api";
import { guardarCacheSesion, leerCacheSesion } from "@/lib/cache-sesion";
import { usePanel } from "@/components/panel/contexto";
import { mensajeError } from "@/utils/error";
import { queryFechasCampo } from "@/utils/fechas";
import { useFechaCampo } from "@/hooks/use-fecha-campo";
import { SegTabs } from "./ui/seg-tabs";
import { TopBar } from "./ui/top-bar";
import { BarraSegmentos, RAYADO_EN_CURSO } from "./ui/barra-segmentos";
import { PRESENTISMO_UI, RUTA_PILL } from "./ui/tablero-campo";
import {
  IconoAlerta,
  IconoCheck,
  IconoRefrescar,
  IconoTelefono,
} from "./ui/iconos-campo";
import {
  AvancePresentismo,
  EquipoPresentismo,
  ResumenPresentismo,
} from "./presentismo-equipo";
import styles from "./presentismo.module.css";
import MarcacionesColaborador from "./marcaciones-colaborador";
import { SelectorFechaFiltro } from "./ui/selector-fecha-filtro";
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

type TabType = "resumen" | "rutas" | "tareas";

interface SupervisionPanelProps {
  initialTab?: TabType;
}

function FotoEvidencia({
  id,
  momento,
  tarea,
}: {
  id: number;
  momento: "ANTES" | "DESPUES";
  tarea: string;
}) {
  const [noDisponible, setNoDisponible] = useState(false);
  const etiqueta = momento === "ANTES" ? "Antes" : "Después";
  if (noDisponible) {
    return (
      <div className="flex min-h-32 min-w-0 flex-col items-center justify-center rounded-lg border border-dashed border-line p-2 text-center text-xs text-muted">
        <span>Foto {etiqueta.toLowerCase()} no disponible en el servidor</span>
        <span className="mt-1 font-mono">#{id}</span>
      </div>
    );
  }
  return (
    <a
      href={obtenerUrlFoto(id)}
      target="_blank"
      rel="noopener noreferrer"
      className="min-w-0 rounded-lg border border-line p-1 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
      aria-label={`Abrir foto ${etiqueta.toLowerCase()} de ${tarea}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={obtenerUrlFoto(id)}
        alt={`Foto ${etiqueta.toLowerCase()} de ${tarea}`}
        onError={() => setNoDisponible(true)}
        loading="lazy"
        className="h-28 w-full rounded object-cover"
      />
      <span className="block py-1 text-xs font-medium text-foreground">
        {etiqueta}
      </span>
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
  const hoyStr = useFechaCampo();
  const [periodo, setPeriodo] = useState<PeriodoFiltro>({
    clave: "hoy",
    etiqueta: "Hoy",
    fecha: hoyStr,
    fechaInicio: hoyStr,
    fechaFin: hoyStr,
  });
  const periodoVigente =
    periodo.clave === "hoy"
      ? { ...periodo, fecha: hoyStr, fechaInicio: hoyStr, fechaFin: hoyStr }
      : periodo;
  const fechasPeriodo = queryFechasCampo(periodoVigente);

  const { usuario } = usePanel();
  const [resumen, setResumen] = useState<SupervisionResumenData | null>(null);
  // Período de los datos en pantalla: si coincide con el elegido, se
  // actualizan sin tapar la pantalla.
  const [periodoResumen, setPeriodoResumen] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Colaborador seleccionado para inspección detallada
  const [colaboradorId, setColaboradorId] = useState<number | null>(null);
  const [detalleColab, setDetalleColab] =
    useState<ColaboradorDetalleData | null>(null);
  const [subTabColab, setSubTabColab] = useState<
    "ruta" | "tareas" | "novedades" | "marcaciones"
  >("ruta");

  // Cargar resumen de supervisión según el período seleccionado
  const cargarResumen = useCallback(async () => {
    const peticion = ++peticionResumen.current;
    const claveCache = `presentismo|${usuario.id}|${fechasPeriodo}`;
    const guardado = leerCacheSesion<SupervisionResumenData>(claveCache);
    if (guardado) {
      // Los últimos datos de este período se ven ya; los nuevos llegan después.
      setResumen(guardado.valor);
      setPeriodoResumen(fechasPeriodo);
      setActualizado(
        new Intl.DateTimeFormat("es-PY", {
          timeZone: "America/Asuncion",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(guardado.guardado)),
      );
    }
    try {
      setCargando(true);
      setError(null);
      const query = fechasPeriodo;
      const data = await apiFetch<SupervisionResumenData>(
        `/campo/supervision/resumen${query ? `?${query}` : ""}`,
      );
      if (peticion !== peticionResumen.current) return;
      setResumen(data);
      setPeriodoResumen(fechasPeriodo);
      guardarCacheSesion(claveCache, data);
      setActualizado(
        new Intl.DateTimeFormat("es-PY", {
          timeZone: "America/Asuncion",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date()),
      );
    } catch (e) {
      if (peticion === peticionResumen.current)
        setError(mensajeError(e, "Error al cargar datos de supervisión"));
    } finally {
      if (peticion === peticionResumen.current) setCargando(false);
    }
  }, [fechasPeriodo, usuario.id]);

  useEffect(() => {
    void Promise.resolve().then(cargarResumen);
  }, [cargarResumen]);

  // Cargar detalle de colaborador
  const abrirColaborador = async (
    id: number,
    sub: "ruta" | "tareas" | "novedades" | "marcaciones" = "ruta",
  ) => {
    const peticion = ++peticionDetalle.current;
    setDetalleColab(null);
    setColaboradorId(id);
    setSubTabColab(sub);
    try {
      const queryFecha = fechasPeriodo || `fecha=${hoyStr}`;
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
    const c = detalleColab?.colaborador;
    const ruta = detalleColab?.ruta ?? [];
    const visitados = ruta.filter((p) => p.estado === "completado").length;
    const tareasHechas = (detalleColab?.tareasCategorias ?? []).reduce(
      (s, cat) => s + cat.completadas,
      0,
    );
    const tareasTotal = (detalleColab?.tareasCategorias ?? []).reduce(
      (s, cat) => s + cat.total,
      0,
    );
    const telefono = c?.telefono && c.telefono !== "—" ? c.telefono : "";
    return (
      <div className="campo-screen min-h-[calc(100vh-5rem)] w-full bg-background text-foreground">
        <TopBar
          title={c?.nombre ?? "Colaborador"}
          subtitle="Ruta, tareas, comentarios y fotos del período seleccionado"
          onBack={() => {
            peticionDetalle.current++;
            setColaboradorId(null);
            setDetalleColab(null);
          }}
        />
        <main className="mx-auto w-full max-w-5xl space-y-4 px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
          {!detalleColab || !c ? (
            <PantallaCarga visible mensaje="Cargando ficha del colaborador…" />
          ) : (
            <>
              {/* Cabecera de la ficha: estado, contacto y números del período */}
              <section className="rounded-2xl border border-line bg-surface-raised p-4 shadow-[0_2px_8px_rgba(var(--warm-shadow),0.06)]">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden="true"
                    className={`grid h-14 w-14 shrink-0 place-items-center rounded-full border-[3px] bg-surface-soft text-base font-bold text-foreground ${PRESENTISMO_UI[c.estadoPresentismo].anillo}`}
                  >
                    {c.iniciales}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-muted">{c.zona}</p>
                    <span
                      className={`mt-0.5 inline-flex rounded-md px-2 py-0.5 text-[11px] font-bold ${PRESENTISMO_UI[c.estadoPresentismo].pill}`}
                    >
                      {PRESENTISMO[c.estadoPresentismo].etiqueta}
                    </span>
                  </div>
                  {telefono ? (
                    <a
                      href={`tel:${telefono.replace(/[^+\d]/g, "")}`}
                      aria-label={`Llamar a ${c.nombre}`}
                      className="inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-brand-700 px-3 text-sm font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus dark:bg-brand-500 dark:text-brand-950 dark:hover:brightness-110"
                    >
                      <IconoTelefono className="h-4 w-4" />
                      Llamar
                    </a>
                  ) : null}
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    ["Entrada", c.inicioJornada ?? "—"],
                    [
                      "Salida",
                      c.finJornada ??
                        (c.asistencia === "en_curso" ? "En curso" : "—"),
                    ],
                    ["Locales", `${visitados} de ${ruta.length}`],
                    ["Tareas", `${tareasHechas} de ${tareasTotal}`],
                  ].map(([k, v]) => (
                    <div
                      key={k}
                      className="min-w-0 rounded-xl bg-surface-soft px-3 py-2"
                    >
                      <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                        {k}
                      </dt>
                      <dd className="ft-display mt-0.5 truncate text-lg font-bold tabular-nums text-foreground">
                        {v}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>

              {/* Pestañas de detalle */}
              <SegTabs
                active={subTabColab}
                onChange={setSubTabColab}
                tabs={[
                  { key: "ruta", label: "Locales", icon: NavigationIcon },
                  { key: "tareas", label: "Tareas", icon: ListChecksIcon },
                  { key: "marcaciones", label: "Marcaciones" },
                ]}
              />

              {subTabColab === "marcaciones" ? (
                <MarcacionesColaborador
                  key={`${colaboradorId}:${fechasPeriodo}`}
                  colaboradorId={colaboradorId}
                  periodo={periodoVigente}
                />
              ) : null}

              {subTabColab === "ruta" &&
                (ruta.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">
                    Sin locales asignados en el período.
                  </p>
                ) : (
                  <ol className="space-y-2" aria-label="Locales del período">
                    {ruta.map((p, i) => (
                      <li
                        key={p.localId}
                        className="flex min-w-0 items-center gap-3 rounded-xl border border-line bg-surface-raised p-3 shadow-[0_2px_8px_rgba(var(--warm-shadow),0.04)]"
                      >
                        <span
                          aria-hidden="true"
                          className={`ft-display grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold ${RUTA_PILL[p.estado]}`}
                        >
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="break-words text-sm font-semibold text-foreground">
                            {p.local}
                          </p>
                          <p className="break-words text-[11px] text-muted">
                            {[
                              p.localId,
                              p.ventana ? `Franja ${p.ventana}` : "Sin franja",
                              p.checkin ? `Entrada ${p.checkin}` : null,
                              p.checkout ? `Salida ${p.checkout}` : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${RUTA_PILL[p.estado]}`}
                          >
                            {RUTA[p.estado].etiqueta}
                          </span>
                          {p.estadoPresentismo !== "SIN_REGISTRO" ? (
                            <span
                              className={`rounded-md px-1.5 text-[10px] font-bold ${PRESENTISMO_UI[p.estadoPresentismo].pill}`}
                            >
                              {PRESENTISMO[p.estadoPresentismo].etiqueta}
                            </span>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ol>
                ))}

              {subTabColab === "tareas" && (
                <div className="space-y-3">
                  {detalleColab.tareasCategorias.length === 0 &&
                  (detalleColab.evidencias ?? []).length === 0 ? (
                    <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">
                      Sin tareas registradas en el período.
                    </p>
                  ) : (
                    detalleColab.tareasCategorias.map((cat) => {
                      const avance = cat.total
                        ? Math.round((cat.completadas / cat.total) * 100)
                        : 0;
                      return (
                        <section
                          key={cat.categoria}
                          className="rounded-xl border border-line bg-surface-raised p-3 shadow-[0_2px_8px_rgba(var(--warm-shadow),0.04)]"
                        >
                          <div className="mb-1.5 flex items-center justify-between gap-2">
                            <h3 className="truncate text-sm font-bold text-foreground">
                              {cat.categoria}
                            </h3>
                            <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted">
                              {cat.obligPendiente ? (
                                <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-800 dark:bg-red-950/60 dark:text-red-300">
                                  Obligatoria pendiente
                                </span>
                              ) : null}
                              <b className="tabular-nums text-foreground">
                                {cat.completadas}
                              </b>
                              /{cat.total}
                            </span>
                          </div>
                          <BarraSegmentos
                            total={cat.total}
                            segmentos={[
                              {
                                valor: cat.completadas,
                                clase:
                                  avance < 50
                                    ? "bg-amber-500 dark:bg-amber-400"
                                    : "bg-emerald-600 dark:bg-emerald-500",
                                etiqueta: "hechas",
                              },
                            ]}
                          />
                          {cat.tareas.length ? (
                            <ul className="mt-2 flex flex-wrap gap-1.5">
                              {cat.tareas.map((t) => (
                                <li
                                  key={t.id}
                                  className={`inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                                    t.completada
                                      ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300"
                                      : t.esObligatoria
                                        ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300"
                                        : "border-line bg-surface-soft text-muted"
                                  }`}
                                >
                                  {t.completada ? (
                                    <IconoCheck className="h-3 w-3 shrink-0" />
                                  ) : null}
                                  <span className="truncate">{t.nombre}</span>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </section>
                      );
                    })
                  )}
                  {(detalleColab.evidencias ?? []).length > 0 && (
                    <div className="space-y-3 border-t border-line pt-3">
                      <h3 className="text-sm font-semibold text-foreground">
                        Detalle de visitas y evidencias
                      </h3>
                      {(detalleColab.evidencias ?? []).map((evidencia) => (
                        <article
                          key={`${evidencia.visitaId}-${evidencia.tareaId}`}
                          className="min-w-0 space-y-2 rounded-xl border border-line bg-surface-raised p-3"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h4 className="break-words text-sm font-semibold text-foreground">
                                {evidencia.nombreTarea}
                              </h4>
                              <p className="break-words text-xs text-muted">
                                {evidencia.local}
                              </p>
                            </div>
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                                evidencia.completadaAt
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                  : "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300"
                              }`}
                            >
                              {evidencia.completadaAt
                                ? "Completada"
                                : "En curso"}
                            </span>
                          </div>
                          <p className="text-xs text-muted">
                            Visita:{" "}
                            {new Date(evidencia.entrada).toLocaleString(
                              "es-PY",
                            )}{" "}
                            · Salida:{" "}
                            {evidencia.salida
                              ? new Date(evidencia.salida).toLocaleTimeString(
                                  "es-PY",
                                )
                              : evidencia.estado === "EN_CURSO"
                                ? "en curso"
                                : "sin salida registrada"}{" "}
                            ·{" "}
                            {PRESENTISMO[evidencia.estadoPresentismo].etiqueta}
                          </p>
                          {evidencia.completadaAt && (
                            <p className="text-xs text-muted">
                              Completada:{" "}
                              {new Date(evidencia.completadaAt).toLocaleString(
                                "es-PY",
                              )}
                            </p>
                          )}
                          {evidencia.fotos.length > 0 && (
                            <div className="grid grid-cols-2 gap-2">
                              {evidencia.fotos.map((foto) => (
                                <FotoEvidencia
                                  key={foto.id}
                                  id={foto.id}
                                  momento={foto.momento}
                                  tarea={evidencia.nombreTarea}
                                />
                              ))}
                            </div>
                          )}
                          {evidencia.comentarios.length > 0 && (
                            <div className="space-y-1 border-t border-line pt-2">
                              <p className="text-xs font-semibold text-foreground">
                                Comentarios
                              </p>
                              {evidencia.comentarios.map((comentario) => (
                                <p
                                  key={comentario.id}
                                  className="break-words text-xs text-muted"
                                >
                                  <strong>
                                    {comentario.usuario.nombre}{" "}
                                    {comentario.usuario.apellido}:
                                  </strong>{" "}
                                  {comentario.comentario}
                                </p>
                              ))}
                            </div>
                          )}
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    );
  }

  // Actualizar va en la primera card de cada pestaña: arriba ya no entra junto a los chips de fecha.
  const botonActualizar = (
    <button
      type="button"
      className={styles.refresh}
      onClick={cargarResumen}
      disabled={cargando}
      aria-busy={cargando}
      aria-label="Actualizar presentismo"
      title="Actualizar presentismo"
    >
      <IconoRefrescar />
    </button>
  );

  return (
    <div className={`campo-screen ${styles.screen}`}>
      <header className={styles.header}>
        <div>
          <h1>Desempeño</h1>
          <p>
            Equipo comercial · {resumen?.fecha ?? periodo.etiqueta}
            {actualizado ? ` · Actualizado ${actualizado}` : ""}
          </p>
        </div>
        <div className={styles.toolbar}>
          <SelectorFechaFiltro
            valorActual={periodo}
            onChange={(valor) => {
              setPeriodo(valor);
              setFiltroEquipo("todos");
            }}
          />
          <Link
            href="/panel/organigrama"
            className={styles.organigrama}
            title="Organigrama: ver quién está a cargo de quién"
            aria-label="Organigrama"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="9" y="3" width="6" height="5" rx="1" />
              <rect x="3" y="16" width="6" height="5" rx="1" />
              <rect x="15" y="16" width="6" height="5" rx="1" />
              <path d="M12 8v4M6 16v-2h12v2" />
            </svg>
            <span className="sr-only">Organigrama</span>
          </Link>
        </div>
      </header>

      {/* Pestañas arriba en todos los tamaños: la barra inferior propia quedaba
          tapada por la navegación de la app en el celular. */}
      <SegTabs
        active={tab}
        onChange={setTab}
        tabs={navItems}
        className="bg-surface-raised px-2 sm:px-6"
      />

      <div className="flex min-w-0 w-full flex-col bg-background">
        {cargando && !resumen ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12">
            <PantallaCarga
              visible
              mensaje="Cargando información operativa del equipo..."
            />
          </div>
        ) : error ? (
          <div
            className="mx-auto my-4 w-[calc(100%-2rem)] max-w-2xl rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
            role="alert"
          >
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
          <div className="flex flex-1 flex-col">
            {/* ==================== EQUIPO ==================== */}
            {tab === "resumen" && resumen && (
              <div className={styles.body}>
                <ResumenPresentismo
                  resumen={resumen}
                  accion={botonActualizar}
                  onFiltrar={(valor) => {
                    setFiltroEquipo(valor);
                    equipoRef.current?.scrollIntoView({
                      block: "start",
                      behavior: "instant",
                    });
                  }}
                />
                <div
                  ref={equipoRef}
                  className={`${styles.teamColumn} min-w-0 scroll-mt-24`}
                >
                  <EquipoPresentismo
                    key={resumen.fecha}
                    colaboradores={resumen.colaboradores}
                    filtro={filtroEquipo}
                    onFiltro={setFiltroEquipo}
                    onOpen={(id) => void abrirColaborador(id, "ruta")}
                  />
                </div>
                <AvancePresentismo resumen={resumen} />
              </div>
            )}

            {/* ==================== LOCALES ==================== */}
            {tab === "rutas" && resumen && (
              <div className="mx-auto w-full max-w-7xl flex-1 space-y-4 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
                <ResumenAvance
                  accion={botonActualizar}
                  titulo="Visitas a locales del equipo"
                  porcentaje={resumen.rutas.pct}
                  total={resumen.rutas.total}
                  segmentos={[
                    {
                      valor: resumen.rutas.completadas,
                      clase: "bg-emerald-600 dark:bg-emerald-500",
                      etiqueta: "visitados",
                    },
                    {
                      valor: resumen.rutas.enCurso,
                      clase: RAYADO_EN_CURSO,
                      etiqueta: "en curso",
                    },
                    {
                      valor: resumen.rutas.incompletas,
                      clase: "bg-orange-500 dark:bg-orange-400",
                      etiqueta: "sin salida",
                    },
                    {
                      valor: resumen.rutas.ausentes,
                      clase: "bg-red-600 dark:bg-red-500",
                      etiqueta: "sin visitar",
                    },
                  ]}
                  conteos={[
                    {
                      etiqueta: "Visitados",
                      valor: resumen.rutas.completadas,
                      clase: "text-emerald-700 dark:text-emerald-300",
                    },
                    {
                      etiqueta: "En curso",
                      valor: resumen.rutas.enCurso,
                      clase: "text-sky-700 dark:text-sky-300",
                    },
                    { etiqueta: "Pendientes", valor: resumen.rutas.pendientes },
                    {
                      etiqueta: "Sin visitar",
                      valor: resumen.rutas.ausentes + resumen.rutas.incompletas,
                      clase: "text-red-700 dark:text-red-300",
                    },
                  ]}
                />
                <EquipoPresentismo
                  key={resumen.fecha}
                  colaboradores={resumen.colaboradores}
                  metric="ruta"
                  filtro={filtroEquipo}
                  onFiltro={setFiltroEquipo}
                  onOpen={(id) => void abrirColaborador(id, "ruta")}
                />
              </div>
            )}

            {/* ==================== TAREAS ==================== */}
            {tab === "tareas" && resumen && (
              <div className="mx-auto w-full max-w-7xl flex-1 space-y-4 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
                <ResumenAvance
                  accion={botonActualizar}
                  titulo="Tareas del equipo"
                  porcentaje={resumen.tareas.pct}
                  total={resumen.tareas.total}
                  segmentos={[
                    {
                      valor: resumen.tareas.completadas,
                      clase: "bg-brand-600 dark:bg-brand-500",
                      etiqueta: "hechas",
                    },
                  ]}
                  conteos={[
                    {
                      etiqueta: "Hechas",
                      valor: resumen.tareas.completadas,
                      clase: "text-brand-700 dark:text-brand-200",
                    },
                    {
                      etiqueta: "Pendientes",
                      valor: Math.max(
                        0,
                        resumen.tareas.total - resumen.tareas.completadas,
                      ),
                    },
                    {
                      etiqueta: "Obligatorias",
                      valor: resumen.tareas.obligatoriasPendientes,
                      clase: "text-red-700 dark:text-red-300",
                    },
                  ]}
                  aviso={
                    resumen.tareas.obligatoriasPendientes > 0
                      ? `${resumen.tareas.obligatoriasPendientes} tareas obligatorias pendientes en el equipo`
                      : undefined
                  }
                />
                <EquipoPresentismo
                  key={resumen.fecha}
                  colaboradores={resumen.colaboradores}
                  metric="tareas"
                  filtro={filtroEquipo}
                  onFiltro={setFiltroEquipo}
                  onOpen={(id) => void abrirColaborador(id, "tareas")}
                />
              </div>
            )}
          </div>
        )}
      </div>
      <PantallaCarga
        visible={cargando && !!resumen && periodoResumen !== fechasPeriodo}
        mensaje="Actualizando presentismo…"
      />
    </div>
  );
}

/** Resumen de avance de una pestaña: porcentaje, barra apilada y contadores. */
function ResumenAvance({
  titulo,
  porcentaje,
  total,
  segmentos,
  conteos,
  aviso,
  accion,
}: {
  accion?: ReactNode;
  titulo: string;
  porcentaje: number;
  total: number;
  segmentos: Parameters<typeof BarraSegmentos>[0]["segmentos"];
  conteos: { etiqueta: string; valor: number; clase?: string }[];
  aviso?: string;
}) {
  return (
    <section className="rounded-2xl border border-line bg-surface-raised p-4 shadow-[0_2px_8px_rgba(var(--warm-shadow),0.06)] sm:p-5">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
            {titulo}
          </p>
          <p className="text-xs text-muted">{total} en el período</p>
        </div>
        <div className="flex shrink-0 items-end gap-2">
          <p className="ft-display text-4xl font-bold leading-none tabular-nums text-foreground">
            {porcentaje}
            <small className="text-lg font-semibold text-muted">%</small>
          </p>
          {accion}
        </div>
      </div>
      <div className="mt-3">
        <BarraSegmentos total={total} segmentos={segmentos} alto="h-2.5" />
      </div>
      <div
        className={`mt-3 grid gap-1.5 ${conteos.length === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"}`}
      >
        {conteos.map((i) => (
          <div
            key={i.etiqueta}
            className="min-w-0 rounded-lg bg-surface-soft px-2.5 py-1.5"
          >
            <b
              className={`ft-display block whitespace-nowrap text-xl leading-tight tabular-nums ${i.clase ?? "text-foreground"}`}
            >
              {i.valor}
              <small className="text-xs font-semibold text-muted">/{total}</small>
            </b>
            <span className="block truncate text-[11px] text-muted">
              {i.etiqueta} ·{" "}
              <b className="font-semibold tabular-nums">
                {total ? Math.round((i.valor / total) * 100) : 0}%
              </b>
            </span>
          </div>
        ))}
      </div>
      {aviso ? (
        <p className="mt-3 flex items-center gap-2 border-t border-line pt-3 text-sm font-semibold text-red-700 dark:text-red-300">
          <IconoAlerta className="h-4 w-4 shrink-0" />
          {aviso}
        </p>
      ) : null}
    </section>
  );
}
