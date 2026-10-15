"use client";
import { ColorHorario } from "@/components/color-horario";
import { EstadoTelefono } from "./estado-telefono";
import { PRESENTISMO, RUTA } from "@/utils/estado-jornada";
import { StatusStamp } from "./ui/status-stamp";
import { ResumenRuta } from "./ui/resumen-ruta";
import type { MarcacionPendiente } from "@/types/seguimiento";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useListaCampo, useOperacionCampo } from "@/hooks/use-lista-campo";
import { useFechaCampo } from "@/hooks/use-fecha-campo";
import {
  fechaEnZonaIso,
  formatoFechaHora,
  queryFechasCampo,
} from "@/utils/fechas";
import {
  SelectorFechaFiltro,
  type PeriodoFiltro,
} from "./ui/selector-fecha-filtro";
import { Modal } from "@/components/modal";
import { PantallaCarga } from "@/components/pantalla-carga";
import { btnGhost, btnPrimary, errorBox } from "@/components/ui";
import { TablaCampo } from "./tabla-campo";
import { BotonesFormulario, CampoTexto } from "./form-campo";
import { MapaLocal } from "./mapa-local";
import type {
  AgendaCampo,
  LocalCampo,
  MarcaCampo,
  TareaJornadaCampo,
  VisitaCampo,
} from "@/types/campo";

export function JornadaPanel({
  tareas = false,
  esRepositor = false,
}: {
  tareas?: boolean;
  esRepositor?: boolean;
}) {
  const hoyStr = useFechaCampo();
  const [periodo, setPeriodo] = useState<PeriodoFiltro>({
    clave: "hoy",
    etiqueta: "Hoy",
    fecha: hoyStr,
    fechaInicio: hoyStr,
    fechaFin: hoyStr,
  });
  const qsFecha = periodo.clave === "hoy" ? `fecha=${hoyStr}` : queryFechasCampo(periodo) || `fecha=${hoyStr}`;
  return (
    <div className="min-w-0 w-full px-4 py-3 sm:px-6 sm:py-5 lg:px-8">
      <header className="mb-2 flex min-w-0 flex-wrap items-center justify-between gap-2 sm:mb-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold">{tareas ? "Mis tareas del día" : "Mis locales"}</h1>
          <p className="mt-1 hidden text-xs text-muted sm:block">{esRepositor ? "Marcá entrada con UCheck activo y completá las tareas antes de salir." : "Tu agenda y reemplazos."}</p>
        </div>
        <SelectorFechaFiltro valorActual={periodo} onChange={setPeriodo} />
      </header>
      <AgendaDelDia key={qsFecha} qsFecha={qsFecha} esRepositor={esRepositor} />
    </div>
  );
}
function AgendaDelDia({
  qsFecha,
  esRepositor,
}: {
  qsFecha: string;
  esRepositor: boolean;
}) {
  const router = useRouter();
  const hoyStr = useFechaCampo();
  const lista = useListaCampo<AgendaCampo>(`/campo/jornada?${qsFecha}`);
  const [visitaAbierta, setAbierta] = useState<VisitaCampo | null>(null);
  const abierta = visitaAbierta?.fecha.slice(0, 10) === hoyStr ? visitaAbierta : null;
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
    radioMetros: number;
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
  }, [revision, hoyStr]);

  function actualizar() {
    lista.refrescar();
    setRevision((n) => n + 1);
  }

  const hoy = new URLSearchParams(qsFecha).get("fecha") === hoyStr;

  // Filtrado de items por búsqueda
  const itemsFiltrados = useMemo(() => {
    if (!busqueda.trim()) return lista.items;
    const q = busqueda.toLowerCase();
    return lista.items.filter(
      (a) =>
        a.local.nombre.toLowerCase().includes(q) ||
        (a.local.cliente?.nombre ?? "Sin cliente").toLowerCase().includes(q) ||
        a.local.direccion.toLowerCase().includes(q),
    );
  }, [lista.items, busqueda]);

  // Métricas del día (StatChips estilo HTML)
  const visitadas = lista.items.filter((a) =>
    a.estado === "completado",
  ).length;
  const enCurso = lista.items.filter(a => a.estado === "en_curso").length;
  const pendientes = lista.items.filter(a => a.estado === "pendiente").length;

  return (
    <>
      {error ? <p className={errorBox}>{error}</p> : null}

      <div className="mb-2 sm:mb-3">
        <ResumenRuta total={lista.datos?.total ?? "—"} visitadas={visitadas} enCurso={enCurso} pendientes={pendientes}
          incompletas={lista.items.filter(a => a.estado === "incompleto").length} ausentes={lista.items.filter(a => a.estado === "ausente").length} porPagina />
      </div>

      {/* Banner de visita en curso */}
      {abierta ? (
        <div className="mb-2 flex min-w-0 items-center gap-2 rounded-lg border border-sky-500 bg-sky-50/60 px-3 py-1 sm:mb-3 dark:border-sky-700 dark:bg-sky-950/40">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-sky-600 dark:bg-sky-400" />
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-foreground" title={`Visita en curso · ${abierta.local.nombre}`}>
                En curso · {abierta.local.nombre}
              </p>
              <p className="truncate text-[11px] text-muted font-mono">
                Entrada: {formatoFechaHora(abierta.entrada)}
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label={`Marcar salida de ${abierta.local.nombre}`}
            className="flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-line bg-surface-raised px-3 text-xs font-semibold text-foreground transition hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus dark:border-line dark:bg-surface-raised dark:text-foreground dark:hover:bg-surface-soft"
            onClick={() =>
              setMarca({
                asignacionId: abierta.asignacionId,
                visitaId: abierta.id,
                nombre: abierta.local.nombre,
                radioMetros: abierta.local.radioMetros,
              })
            }
          >
            <svg
              className="h-4 w-4"
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
            Salida
          </button>
        </div>
      ) : null}

      {/* Buscador de locales de la agenda */}
      <div className={`mb-2 flex min-w-0 w-full items-center gap-2 sm:mb-3 ${esRepositor ? "" : "flex-wrap sm:justify-between"}`}>
        <div className={`relative min-w-0 flex-1 ${esRepositor ? "" : "sm:max-w-sm"}`}>
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
            aria-label="Buscar local en esta página de la agenda"
            name="buscar-local"
            autoComplete="off"
            placeholder={esRepositor ? "Buscar local…" : "Buscar en esta página…"}
            className={`h-11 min-h-11 w-full rounded-lg border border-line bg-surface-raised py-2 pl-9 ${busqueda ? "pr-11" : "pr-3"} text-base text-foreground outline-none transition-colors placeholder:text-muted focus-visible:border-brand-600 focus-visible:ring-2 focus-visible:ring-brand-600/30 sm:text-sm dark:border-line dark:bg-surface-raised dark:text-foreground`}
          />
          {busqueda && (
            <button
              type="button"
              onClick={() => setBusqueda("")}
              aria-label="Limpiar búsqueda de locales"
              className="absolute inset-y-0 right-0 flex min-w-11 items-center justify-center rounded-r-xl text-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
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
        {esRepositor ? (
          <EstadoTelefono variante="boton" />
        ) : (
          <div className="hidden text-xs text-muted sm:block">
            <span>{itemsFiltrados.length} locales visibles en esta página</span>
          </div>
        )}
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
                  <strong className="block font-semibold text-foreground">
                    {a.local.nombre}
                  </strong>
                  <p className="text-xs text-brand-700 dark:text-brand-400 font-medium">
                    {a.local.cliente?.nombre ?? "Sin cliente"}
                  </p>
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
              return <div className="flex flex-wrap gap-1"><StatusStamp tone={RUTA[a.estado].tone}>{RUTA[a.estado].etiqueta}</StatusStamp>
                <StatusStamp tone={PRESENTISMO[a.estadoPresentismo].tone}>{PRESENTISMO[a.estadoPresentismo].etiqueta}</StatusStamp></div>;
            },
          },
        ]}
        tarjetaMovil={(a) => {
          const estaEnCurso = a.estado === "en_curso";
          const tieneVisitaCerrada = a.estado === "completado";
          const horarios = a.local.horarios;
          const ventanaTexto = horarios.length
            ? horarios.map((h) => `${h.entrada}–${h.salida}`).join(" · ")
            : "Sin horario fijado";

          const statusTone = estaEnCurso
            ? "bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800"
            : tieneVisitaCerrada
              ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
              : "bg-surface-soft text-muted border-line";

          const statusLabel = RUTA[a.estado].etiqueta;

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
                    {a.local.cliente?.nombre ?? "Sin cliente"}
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
                    <span className="truncate">
                      {a.local.direccion || "Sin dirección"}
                    </span>
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <StatusStamp tone={PRESENTISMO[a.estadoPresentismo].tone}>{PRESENTISMO[a.estadoPresentismo].etiqueta}</StatusStamp>
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
                  (a.local.horarios.length ? a.local.horarios : [null]).map(
                    (h) => {
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
                              radioMetros: a.local.radioMetros,
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
                    },
                  )
                ) : estaEnCurso ? (
                  <button
                    type="button"
                    onClick={() =>
                      setMarca({
                        asignacionId: abierta!.asignacionId,
                        visitaId: abierta!.id,
                        nombre: abierta!.local.nombre,
                        radioMetros: abierta!.local.radioMetros,
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
                            radioMetros: a.local.radioMetros,
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
        <VisitasPanel
          key={`visitas-${revision}`}
          fechaInicial={hoyStr}
          propia
        />
      </div>
      {mapa ? <MapaLocal local={mapa} cerrar={() => setMapa(null)} /> : null}
      {tareas ? (
        <TareasDeLocal
          agenda={tareas}
          qsFecha={qsFecha}
          abierta={abierta}
          cerrar={() => setTareas(null)}
        />
      ) : null}
      {marca ? (
        <ModalMarca
          nombre={marca.nombre}
          radioMetros={marca.radioMetros}
          salida={!!marca.visitaId}
          usarTelefonoUcheck={esRepositor}
          alConfirmarPendiente={() => {
            actualizar();
            setMarca(null);
          }}
          cerrar={() => setMarca(null)}
          guardar={async (datos) => {
            const resultado = await apiFetch<{
              estado?: "CONFIRMADA" | "PENDIENTE";
              mensaje?: string;
              operacionId?: string;
            }>(
              marca.visitaId
                ? esRepositor
                  ? `/campo/jornada/repositor/visitas/${marca.visitaId}/salida`
                  : `/campo/jornada/visitas/${marca.visitaId}/salida`
                : esRepositor
                  ? "/campo/jornada/repositor/entrada"
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
            if (resultado.estado === "PENDIENTE" && resultado.operacionId)
              return {
                estado: "PENDIENTE",
                operacionId: resultado.operacionId,
                mensaje:
                  resultado.mensaje ??
                  "Marcación guardada en Ucheck, pendiente de sincronización.",
              } satisfies MarcacionPendiente;
            actualizar();
            setMarca(null);
            if (esRepositor && !marca.visitaId)
              router.push("/panel/mi-jornada/tareas");
          }}
        />
      ) : null}
    </>
  );
}
function ModalMarca({
  nombre,
  radioMetros,
  salida,
  usarTelefonoUcheck,
  cerrar,
  guardar,
  alConfirmarPendiente,
}: {
  nombre: string;
  radioMetros: number;
  salida: boolean;
  usarTelefonoUcheck: boolean;
  cerrar: () => void;
  guardar: (
    datos: MarcaCampo | { nota: string },
  ) => Promise<void | MarcacionPendiente>;
  alConfirmarPendiente: () => void;
}) {
  const op = useOperacionCampo();
  const [coords, setCoords] = useState<Omit<MarcaCampo, "nota"> | null>(null);
  const [nota, setNota] = useState("");
  const [pendiente, setPendiente] = useState<MarcacionPendiente | null>(null);
  function obtenerGps(): Promise<Omit<MarcaCampo, "nota">> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(
          new Error("GPS no disponible. Activá la ubicación para marcar."),
        );
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (p) =>
          resolve({
            latitud: p.coords.latitude,
            longitud: p.coords.longitude,
            precisionMetros: p.coords.accuracy,
            capturadaEn: new Date(p.timestamp).toISOString(),
          }),
        () =>
          reject(
            new Error(
              "No se pudo obtener GPS. Activá la ubicación y reintentá.",
            ),
          ),
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
      );
    });
  }
  async function ubicar() {
    await op.ejecutar("Obteniendo ubicación", async () => {
      setCoords(await obtenerGps());
    });
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
          if (pendiente) {
            await op.ejecutar(
              "Consultando la confirmación de la marcación",
              async () => {
                const estado = await apiFetch<{
                  estado: string;
                  mensaje: string;
                }>(
                  `/campo/jornada/repositor/operaciones/${pendiente.operacionId}`,
                );
                if (estado.estado === "CONFIRMADA") alConfirmarPendiente();
                else setPendiente({ ...pendiente, mensaje: estado.mensaje });
              },
            );
            return;
          }
          await op.ejecutar(
            usarTelefonoUcheck
              ? "Consultando el teléfono en Ucheck y registrando la visita…"
              : "Obteniendo ubicación y registrando presencia…",
            async () => {
              if (usarTelefonoUcheck) {
                const resultado = await guardar({ nota });
                if (resultado?.estado === "PENDIENTE") setPendiente(resultado);
                return;
              }
              const posicion = await obtenerGps();
              setCoords(posicion);
              await guardar({ ...posicion, nota });
            },
          );
        }}
      >
        {!usarTelefonoUcheck ? (
          <button
            type="button"
            className={`${btnGhost} w-full`}
            onClick={() => void ubicar()}
          >
            Obtener mi ubicación
          </button>
        ) : null}
        {usarTelefonoUcheck ? (
          <div className="rounded-xl border border-line bg-surface-soft p-4 text-sm text-foreground">
            <EstadoTelefono />
            <p className="font-semibold">Antes de confirmar en Comercia</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted">
              <li>Abrí Ucheck en el teléfono con tu cuenta de repositor.</li>
              <li>
                Esperá el estado “Ubicación confirmada”. Si está pendiente, tocá
                “Actualizar ubicación”.
              </li>
              <li>
                Mantené Ucheck abierta en segundo plano durante la visita.
              </li>
            </ol>
          </div>
        ) : (
          <p className="text-sm text-muted">
            {coords
              ? `Ubicación obtenida: ${coords.latitud.toFixed(5)}, ${coords.longitud.toFixed(5)} · precisión ±${Math.round(coords.precisionMetros)} m`
              : "Se necesita GPS para marcar. Al confirmar se obtendrá una ubicación nueva."}
          </p>
        )}
        <p className="text-sm text-muted">
          Radio permitido: {radioMetros} m desde el local.
        </p>
        <CampoTexto
          titulo="Observación (opcional)"
          maxLength={250}
          value={nota}
          onChange={setNota}
        />
        {op.error ? (
          <p role="alert" className={errorBox}>
            {op.error}
          </p>
        ) : null}
        {pendiente ? (
          <p
            role="status"
            className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
          >
            {pendiente.mensaje}
          </p>
        ) : null}
        <BotonesFormulario ocupado={!!op.mensaje} cancelar={cerrar}>
          {pendiente
            ? "Consultar confirmación"
            : `Confirmar ${salida ? "salida" : "entrada"}`}
        </BotonesFormulario>
      </form>
      <PantallaCarga visible={!!op.mensaje} mensaje={op.mensaje} />
    </Modal>
  );
}
function TareasDeLocal({
  agenda,
  qsFecha,
  abierta,
  cerrar,
}: {
  agenda: AgendaCampo;
  qsFecha: string;
  abierta: VisitaCampo | null;
  cerrar: () => void;
}) {
  const lista = useListaCampo<TareaJornadaCampo>(
    `/campo/jornada/asignaciones/${agenda.id}/tareas?${qsFecha}`,
  );
  const op = useOperacionCampo();
  const visita = abierta?.asignacionId === agenda.id ? abierta : null;
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
          : "Registrá entrada para completar tareas."}
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
        {propia ? "Mi presentismo" : "Presentismo"}
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
            `${formatoFechaHora(v.entrada)} / ${v.salida ? formatoFechaHora(v.salida) : v.estado === "EN_CURSO" ? "En curso" : "Sin salida registrada"}`,
        },
        { titulo: "Estado", valor: v => <div className="flex flex-wrap gap-1"><StatusStamp tone={PRESENTISMO[v.estadoPresentismo].tone}>{PRESENTISMO[v.estadoPresentismo].etiqueta}</StatusStamp><ColorHorario color={v.entradaColor}>Entrada: </ColorHorario><ColorHorario color={v.salidaColor}>Salida: </ColorHorario></div> },
        { titulo: "Minutos computables", valor: v => v.minutosComputables ?? "—" },
        { titulo: "Tareas", valor: (v) => v._count.cumplimientos },
        {
          titulo: "Observaciones",
          valor: (v) => `${v.notaEntrada} ${v.notaSalida}`,
        },
      ]}
    />
  );
}
