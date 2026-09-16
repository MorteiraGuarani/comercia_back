"use client";
import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useListaCampo, useOperacionCampo } from "@/hooks/use-lista-campo";
import { fechaEnZonaIso, formatoFechaHora } from "@/utils/fechas";
import { Modal } from "@/components/modal";
import { PantallaCarga } from "@/components/pantalla-carga";
import { btnGhost, btnPrimary, errorBox } from "@/components/ui";
import { TablaCampo } from "./tabla-campo";
import { BotonesFormulario, CabeceraCampo, CampoTexto } from "./form-campo";
import { MapaLocal } from "./mapa-local";
import type {
  AgendaCampo,
  LocalCampo,
  MarcaCampo,
  TareaJornadaCampo,
  VisitaCampo,
} from "@/types/campo";

export function JornadaPanel({ tareas = false }: { tareas?: boolean }) {
  const [fecha, setFecha] = useState(fechaEnZonaIso(new Date()));
  return (
    <>
      <CabeceraCampo
        titulo={tareas ? "Mis tareas del día" : "Mis locales"}
        detalle="Tu agenda y reemplazos. Podés registrar presencia aunque el local no tenga tareas."
      />
      <div className="mb-4 max-w-xs">
        <CampoTexto
          titulo="Fecha"
          type="date"
          required
          value={fecha}
          onChange={setFecha}
        />
      </div>
      {fecha ? <AgendaDelDia key={fecha} fecha={fecha} /> : null}
    </>
  );
}
function AgendaDelDia({ fecha }: { fecha: string }) {
  const lista = useListaCampo<AgendaCampo>(`/campo/jornada?fecha=${fecha}`);
  const [abierta, setAbierta] = useState<VisitaCampo | null>(null);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const [mapa, setMapa] = useState<LocalCampo | null>(null);
  const [tareas, setTareas] = useState<AgendaCampo | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [marca, setMarca] = useState<{
    asignacionId: number;
    horarioId?: number;
    visitaId?: number;
    nombre: string;
  } | null>(null);

  useEffect(() => {
    let vigente = true;
    apiFetch<VisitaCampo | null>("/campo/jornada/abierta")
      .then((v) => {
        if (vigente) setAbierta(v);
      })
      .catch((e: Error) => {
        if (vigente) setError(e.message);
      });
    return () => {
      vigente = false;
    };
  }, [revision]);

  function actualizar() {
    lista.refrescar();
    setRevision((n) => n + 1);
  }

  const hoy = fecha === fechaEnZonaIso(new Date());

  // Filtrado de items por búsqueda
  const itemsFiltrados = useMemo(() => {
    if (!busqueda.trim()) return lista.items;
    const q = busqueda.toLowerCase();
    return lista.items.filter(
      (a) =>
        a.local.nombre.toLowerCase().includes(q) ||
        a.local.cliente.nombre.toLowerCase().includes(q) ||
        a.local.direccion.toLowerCase().includes(q),
    );
  }, [lista.items, busqueda]);

  // Métricas del día (StatChips estilo HTML)
  const totalParadas = lista.items.length;
  const visitadas = lista.items.filter((a) => a.visitas.some((v) => v.salida)).length;
  const enCurso = abierta ? 1 : 0;
  const pendientes = Math.max(0, totalParadas - visitadas - (abierta && lista.items.some(a => a.local.id === abierta.local.id && !a.visitas.some(v => v.salida)) ? 1 : 0));

  return (
    <>
      {error ? <p className={errorBox}>{error}</p> : null}

      {/* StatChips de resumen de la jornada */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-xl border border-line bg-surface-raised p-3 text-center shadow-sm">
          <div className="text-2xl font-bold leading-none text-foreground">
            {totalParadas}
          </div>
          <div className="mt-1 text-[11px] font-medium text-muted">
            Total paradas
          </div>
        </div>
        <div className="rounded-xl border border-emerald-300/60 bg-emerald-50/50 p-3 text-center shadow-sm dark:border-emerald-800/60 dark:bg-emerald-950/20">
          <div className="text-2xl font-bold leading-none text-emerald-700 dark:text-emerald-400">
            {visitadas}
          </div>
          <div className="mt-1 text-[11px] font-medium text-emerald-800 dark:text-emerald-300">
            Visitadas
          </div>
        </div>
        <div className="rounded-xl border border-sky-300/60 bg-sky-50/50 p-3 text-center shadow-sm dark:border-sky-800/60 dark:bg-sky-950/20">
          <div className="text-2xl font-bold leading-none text-sky-700 dark:text-sky-400">
            {enCurso}
          </div>
          <div className="mt-1 text-[11px] font-medium text-sky-800 dark:text-sky-300">
            En curso
          </div>
        </div>
        <div className="rounded-xl border border-line bg-surface-raised p-3 text-center shadow-sm">
          <div className="text-2xl font-bold leading-none text-muted">
            {pendientes}
          </div>
          <div className="mt-1 text-[11px] font-medium text-muted">
            Pendientes
          </div>
        </div>
      </div>

      {/* Banner de visita en curso */}
      {abierta ? (
        <div className="mb-4 flex flex-col gap-3 rounded-xl border-2 border-sky-500 bg-sky-50/60 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:bg-sky-950/40">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75"></span>
              <span className="relative inline-flex h-3 w-3 rounded-full bg-sky-500"></span>
            </span>
            <div>
              <p className="font-bold text-foreground">
                Visita en curso · {abierta.local.nombre}
              </p>
              <p className="text-xs text-muted font-mono">
                Check-in registrado: {formatoFechaHora(abierta.entrada)}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="min-h-11 rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
            onClick={() =>
              setMarca({
                asignacionId: abierta.asignacionId,
                visitaId: abierta.id,
                nombre: abierta.local.nombre,
              })
            }
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Marcar salida
          </button>
        </div>
      ) : null}

      {/* Buscador de locales de la agenda */}
      <div className="mb-4 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted">
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="2"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar local en agenda de hoy…"
            className="w-full rounded-xl border border-line bg-surface-raised py-2 pl-9 pr-8 text-sm text-foreground outline-none transition placeholder:text-muted focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30"
          />
          {busqueda && (
            <button
              type="button"
              onClick={() => setBusqueda("")}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted hover:text-foreground"
              title="Limpiar búsqueda"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth="2"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
        <div className="text-xs text-muted">
          <span>{itemsFiltrados.length} locales para esta fecha</span>
        </div>
      </div>

      <TablaCampo
        lista={{ ...lista, items: itemsFiltrados }}
        etiqueta="Agenda"
        columnas={[
          {
            titulo: "Local",
            valor: (a) => (
              <div className="flex items-center gap-2.5">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line bg-surface-soft text-foreground">
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth="1.8"
                    aria-hidden="true"
                  >
                    <path d="M4 10 5 4h14l1 6" />
                    <rect x="4" y="10" width="16" height="10" rx="1" />
                    <line x1="9" y1="20" x2="9" y2="14" />
                    <line x1="15" y1="14" x2="15" y2="20" />
                  </svg>
                </div>
                <div>
                  <strong className="block font-semibold text-foreground">{a.local.nombre}</strong>
                  <p className="text-xs text-brand-700 dark:text-brand-400 font-medium">{a.local.cliente.nombre}</p>
                </div>
              </div>
            ),
          },
          {
            titulo: "Asignación",
            valor: (a) => (
              <span className="inline-flex items-center rounded-full bg-surface-soft px-2.5 py-0.5 text-xs font-medium text-foreground">
                {a.esBackup ? `Backup de ${a.titular}` : "Titular"}
              </span>
            ),
          },
          {
            titulo: "Horario de Atención",
            valor: (a) =>
              a.local.horarios.length ? (
                <div className="flex flex-wrap gap-1 font-mono text-xs">
                  {a.local.horarios.map((h) => (
                    <span
                      key={h.id}
                      className="inline-flex items-center gap-1 rounded bg-surface-soft px-2 py-0.5"
                    >
                      <svg
                        className="h-3 w-3 text-muted shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        strokeWidth="2"
                        aria-hidden="true"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      {h.entrada}–{h.salida}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-muted">Sin horario fijado</span>
              ),
          },
          {
            titulo: "Estado",
            valor: (a) => {
              const estaEnCurso = abierta?.local.id === a.local.id;
              const tieneVisitaCerrada = a.visitas.some((v) => v.salida);
              return (
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold border tracking-wider ${
                    estaEnCurso
                      ? "bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800"
                      : tieneVisitaCerrada
                        ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                        : "bg-surface-soft text-muted border-line"
                  }`}
                >
                  {estaEnCurso ? "EN CURSO" : tieneVisitaCerrada ? "VISITADO" : "PENDIENTE"}
                </span>
              );
            },
          },
        ]}
        tarjetaMovil={(a) => {
          const estaEnCurso = abierta?.local.id === a.local.id;
          const tieneVisitaCerrada = a.visitas.some((v) => v.salida);
          const horarios = a.local.horarios;
          const ventanaTexto = horarios.length
            ? horarios.map((h) => `${h.entrada}–${h.salida}`).join(" · ")
            : "Sin horario fijado";

          const statusTone = estaEnCurso
            ? "bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800"
            : tieneVisitaCerrada
              ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
              : "bg-surface-soft text-muted border-line";

          const statusLabel = estaEnCurso
            ? "EN CURSO"
            : tieneVisitaCerrada
              ? "VISITADO"
              : "PENDIENTE";

          return (
            <div
              className={`rounded-xl border p-4 shadow-[0_2px_8px_rgba(var(--warm-shadow),0.06)] transition-[border-color,box-shadow] ${
                estaEnCurso
                  ? "border-sky-500/60 bg-surface-raised ring-2 ring-sky-500/20"
                  : "border-line bg-surface-raised hover:border-brand-500/40"
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Ícono de tienda con avatar circular */}
                <div
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border ${
                    estaEnCurso
                      ? "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300 border-sky-300"
                      : tieneVisitaCerrada
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300"
                        : "bg-surface-soft text-foreground border-line"
                  }`}
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth="1.8"
                    aria-hidden="true"
                  >
                    <path d="M4 10 5 4h14l1 6" />
                    <rect x="4" y="10" width="16" height="10" rx="1" />
                    <line x1="9" y1="20" x2="9" y2="14" />
                    <line x1="15" y1="14" x2="15" y2="20" />
                  </svg>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="truncate font-semibold text-base text-foreground">
                      {a.local.nombre}
                    </h4>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold border tracking-wider ${statusTone}`}
                    >
                      {statusLabel}
                    </span>
                  </div>

                  <p className="mt-0.5 text-xs font-semibold text-brand-700 dark:text-brand-400 truncate">
                    {a.local.cliente.nombre}
                  </p>

                  <p className="mt-1 flex items-center gap-1 text-xs text-muted truncate">
                    <svg
                      className="h-3.5 w-3.5 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth="2"
                      aria-hidden="true"
                    >
                      <path d="M12 21c-4-4.6-7-8.3-7-11.5A7 7 0 0 1 19 9.5C19 12.7 16 16.4 12 21z" />
                      <circle cx="12" cy="9.5" r="2.3" />
                    </svg>
                    <span className="truncate">{a.local.direccion || "Sin dirección"}</span>
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-md bg-surface-soft px-2 py-0.5 font-mono text-[11px] text-foreground">
                      <svg
                        className="h-3 w-3 text-muted shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        strokeWidth="2"
                        aria-hidden="true"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      {ventanaTexto}
                    </span>
                    <span className="text-[11px] text-muted">
                      {a.esBackup ? `Backup de ${a.titular}` : "Titular"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Botones de acción móvil (touch-friendly >= 44px) */}
              <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-line/60 pt-3">
                {hoy && !abierta ? (
                  (a.local.horarios.length ? a.local.horarios : [null]).map((h) => {
                    const realizada = a.visitas.some(
                      (v) => v.horarioId === (h?.id ?? null),
                    );
                    return (
                      <button
                        key={h?.id ?? 0}
                        type="button"
                        disabled={realizada}
                        onClick={() =>
                          setMarca({
                            asignacionId: a.id,
                            horarioId: h?.id,
                            nombre: a.local.nombre,
                          })
                        }
                        className={`min-h-11 flex-1 rounded-lg px-3 py-2 text-xs font-semibold shadow-sm transition-colors flex items-center justify-center gap-1.5 ${
                          realizada
                            ? "border border-line bg-surface-soft text-muted opacity-60 cursor-not-allowed"
                            : "bg-brand-600 text-white hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600"
                        }`}
                      >
                        <svg
                          className="h-3.5 w-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          strokeWidth="2"
                          aria-hidden="true"
                        >
                          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                          <polyline points="10 17 15 12 10 7" />
                          <line x1="15" y1="12" x2="3" y2="12" />
                        </svg>
                        {realizada
                          ? "Registrada"
                          : `Marcar entrada${h ? ` (${h.entrada})` : ""}`}
                      </button>
                    );
                  })
                ) : estaEnCurso ? (
                  <button
                    type="button"
                    onClick={() =>
                      setMarca({
                        asignacionId: abierta!.asignacionId,
                        visitaId: abierta!.id,
                        nombre: abierta!.local.nombre,
                      })
                    }
                    className="min-h-11 flex-1 rounded-lg bg-red-600 text-white hover:bg-red-700 px-3 py-2 text-xs font-bold shadow-sm transition-colors flex items-center justify-center gap-1.5"
                  >
                    <svg
                      className="h-3.5 w-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth="2"
                      aria-hidden="true"
                    >
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    Marcar salida
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => setTareas(a)}
                  className="min-h-11 rounded-lg border border-line bg-surface-soft px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface-raised transition-colors flex items-center justify-center gap-1.5"
                >
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <polyline points="9 11 12 14 22 4" />
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                  </svg>
                  Tareas
                </button>

                <button
                  type="button"
                  onClick={() => setMapa(a.local)}
                  className="min-h-11 rounded-lg border border-line bg-surface-soft px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface-raised transition-colors flex items-center justify-center gap-1.5"
                  title="Ver mapa"
                >
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                    <line x1="8" y1="2" x2="8" y2="18" />
                    <line x1="16" y1="6" x2="16" y2="22" />
                  </svg>
                  Mapa
                </button>
              </div>
            </div>
          );
        }}
        acciones={(a) => (
          <>
            <button className={btnGhost} onClick={() => setMapa(a.local)}>
              Mapa
            </button>
            <button className={btnGhost} onClick={() => setTareas(a)}>
              Tareas
            </button>
            {hoy && !abierta
              ? (a.local.horarios.length ? a.local.horarios : [null]).map(
                  (h) => {
                    const realizada = a.visitas.some(
                      (v) => v.horarioId === (h?.id ?? null),
                    );
                    return (
                      <button
                        key={h?.id ?? 0}
                        className={btnPrimary}
                        disabled={realizada}
                        onClick={() =>
                          setMarca({
                            asignacionId: a.id,
                            horarioId: h?.id,
                            nombre: a.local.nombre,
                          })
                        }
                      >
                        {realizada
                          ? "Registrada"
                          : `Marcar entrada${h ? ` ${h.entrada}` : ""}`}
                      </button>
                    );
                  },
                )
              : null}
          </>
        )}
      />
      <div className="mt-7">
        <VisitasPanel key={`visitas-${revision}`} fechaInicial={fecha} propia />
      </div>
      {mapa ? <MapaLocal local={mapa} cerrar={() => setMapa(null)} /> : null}
      {tareas ? (
        <TareasDeLocal
          agenda={tareas}
          fecha={fecha}
          abierta={abierta}
          cerrar={() => setTareas(null)}
        />
      ) : null}
      {marca ? (
        <ModalMarca
          nombre={marca.nombre}
          salida={!!marca.visitaId}
          cerrar={() => setMarca(null)}
          guardar={async (datos) => {
            await apiFetch(
              marca.visitaId
                ? `/campo/jornada/visitas/${marca.visitaId}/salida`
                : "/campo/jornada/entrada",
              {
                method: "POST",
                body: JSON.stringify({
                  ...datos,
                  ...(!marca.visitaId
                    ? {
                        asignacionId: marca.asignacionId,
                        horarioId: marca.horarioId,
                      }
                    : {}),
                }),
              },
            );
            actualizar();
            setMarca(null);
          }}
        />
      ) : null}
    </>
  );
}
function ModalMarca({
  nombre,
  salida,
  cerrar,
  guardar,
}: {
  nombre: string;
  salida: boolean;
  cerrar: () => void;
  guardar: (datos: MarcaCampo) => Promise<void>;
}) {
  const op = useOperacionCampo();
  const [coords, setCoords] = useState<{
    latitud: number;
    longitud: number;
  } | null>(null);
  const [nota, setNota] = useState("");
  async function ubicar() {
    await op.ejecutar(
      "Obteniendo ubicación",
      () =>
        new Promise<void>((resolve, reject) => {
          if (!navigator.geolocation) {
            reject(
              new Error("GPS no disponible. Indicá un motivo para continuar."),
            );
            return;
          }
          navigator.geolocation.getCurrentPosition(
            (p) => {
              setCoords({
                latitud: p.coords.latitude,
                longitud: p.coords.longitude,
              });
              resolve();
            },
            () =>
              reject(
                new Error(
                  "No se pudo obtener GPS. Reintentá o indicá el motivo para continuar.",
                ),
              ),
            { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
          );
        }),
    );
  }
  return (
    <Modal
      titulo={`${salida ? "Salida" : "Entrada"} · ${nombre}`}
      abierto
      onCerrar={() => {
        if (!op.mensaje) cerrar();
      }}
    >
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          await op.ejecutar("Registrando presencia", () =>
            guardar({ ...coords, nota }),
          );
        }}
      >
        <button
          type="button"
          className={`${btnGhost} w-full`}
          onClick={() => void ubicar()}
        >
          Obtener mi ubicación
        </button>
        <p className="text-sm text-muted">
          {coords
            ? `Ubicación obtenida: ${coords.latitud.toFixed(5)}, ${coords.longitud.toFixed(5)}`
            : "Sin ubicación. Es obligatorio indicar un motivo si no podés usar GPS."}
        </p>
        <CampoTexto
          titulo={
            coords ? "Observación (opcional)" : "Motivo de marcar sin GPS"
          }
          maxLength={250}
          value={nota}
          onChange={setNota}
          required={!coords}
        />
        {op.error ? <p className={errorBox}>{op.error}</p> : null}
        <BotonesFormulario ocupado={!!op.mensaje} cancelar={cerrar}>
          Confirmar {salida ? "salida" : "entrada"}
        </BotonesFormulario>
      </form>
      <PantallaCarga visible={!!op.mensaje} mensaje={op.mensaje} />
    </Modal>
  );
}
function TareasDeLocal({
  agenda,
  fecha,
  abierta,
  cerrar,
}: {
  agenda: AgendaCampo;
  fecha: string;
  abierta: VisitaCampo | null;
  cerrar: () => void;
}) {
  const lista = useListaCampo<TareaJornadaCampo>(
    `/campo/jornada/asignaciones/${agenda.id}/tareas?fecha=${fecha}`,
  );
  const op = useOperacionCampo();
  const visita =
    abierta?.asignacionId === agenda.id && abierta.fecha.slice(0, 10) === fecha
      ? abierta
      : null;
  return (
    <Modal
      titulo={`Tareas · ${agenda.local.nombre}`}
      abierto
      onCerrar={cerrar}
      ancho="lg"
    >
      <p className="mb-4 text-sm text-muted">
        {visita
          ? "Marcá las tareas realizadas en esta visita."
          : "Registrá entrada para completar tareas. Las tareas no impiden registrar salida."}
      </p>
      <TablaCampo
        lista={lista}
        etiqueta="Tareas del local"
        columnas={[
          { titulo: "Tarea", valor: (t) => t.nombre },
          { titulo: "Descripción", valor: (t) => t.descripcion },
          {
            titulo: "Estado",
            valor: (t) =>
              visita
                ? t.visitasCompletadas.includes(visita.id)
                  ? "Completada"
                  : "Pendiente"
                : `${t.visitasCompletadas.length} realizadas hoy`,
          },
        ]}
        acciones={(t) =>
          visita ? (
            <button
              className={btnPrimary}
              disabled={
                t.visitasCompletadas.includes(visita.id) || !!op.mensaje
              }
              onClick={() =>
                void op.ejecutar("Completando tarea", async () => {
                  await apiFetch(
                    `/campo/jornada/visitas/${visita.id}/tareas/${t.id}`,
                    { method: "POST" },
                  );
                  lista.refrescar();
                })
              }
            >
              Completar
            </button>
          ) : null
        }
      />
      {op.error ? <p className={errorBox}>{op.error}</p> : null}
      <PantallaCarga visible={!!op.mensaje} mensaje={op.mensaje} />
    </Modal>
  );
}
export function VisitasPanel({
  propia = false,
  fechaInicial,
}: {
  propia?: boolean;
  fechaInicial?: string;
}) {
  const [fecha, setFecha] = useState(
    fechaInicial ?? fechaEnZonaIso(new Date()),
  );
  return (
    <>
      <h2 className="mb-3 text-lg font-semibold">
        {propia ? "Mis presencias" : "Presencias del equipo"}
      </h2>
      {!propia ? (
        <div className="mb-4 max-w-xs">
          <CampoTexto
            titulo="Fecha"
            type="date"
            value={fecha}
            onChange={setFecha}
            required
          />
        </div>
      ) : null}
      {fecha ? (
        <ListadoVisitas key={fecha} fecha={fecha} propia={propia} />
      ) : null}
    </>
  );
}
function ListadoVisitas({ fecha, propia }: { fecha: string; propia: boolean }) {
  const lista = useListaCampo<VisitaCampo>(
    `/campo/${propia ? "jornada/visitas" : "visitas"}?fecha=${fecha}`,
  );
  return (
    <TablaCampo
      lista={lista}
      etiqueta="Presencias"
      columnas={[
        { titulo: "Local", valor: (v) => v.local.nombre },
        {
          titulo: "Asistió",
          valor: (v) =>
            `${v.usuario.nombre} ${v.usuario.apellido}${v.esBackup ? ` (backup de ${v.asignacion.usuario.nombre})` : ""}`,
        },
        {
          titulo: "Entrada / salida",
          valor: (v) =>
            `${formatoFechaHora(v.entrada)} / ${v.salida ? formatoFechaHora(v.salida) : "En curso"}`,
        },
        { titulo: "Tareas", valor: (v) => v._count.cumplimientos },
        {
          titulo: "Observaciones",
          valor: (v) => `${v.notaEntrada} ${v.notaSalida}`,
        },
      ]}
    />
  );
}
