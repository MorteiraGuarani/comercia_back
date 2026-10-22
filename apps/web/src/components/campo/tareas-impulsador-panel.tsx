"use client";
import dynamic from "next/dynamic";
import { RUTA } from "@/utils/estado-jornada";

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { apiFetch } from "@/lib/api";
import { enviarAccionTarea } from "@/lib/pendientes-tareas";
import { usePanel } from "@/components/panel/contexto";
import { PendientesTareas } from "./pendientes-tareas";
import { mostrarToast } from "@/components/toast/toast-controller";
import { useJornadaCompleta } from "@/hooks/use-jornada-completa";
import { useFechaCampo } from "@/hooks/use-fecha-campo";
import { queryFechasCampo } from "@/utils/fechas";
import { tareaCumplidaEnVisita } from "@/utils/tareas-campo";
import { TOKENS } from "./tokens";
import { StatusStamp } from "./ui/status-stamp";
import { StatChip } from "./ui/stat-chip";
import { TopBar } from "./ui/top-bar";
import { SelectorFechaFiltro, type PeriodoFiltro } from "./ui/selector-fecha-filtro";
import { Modal } from "@/components/modal";
import { PantallaCarga } from "@/components/pantalla-carga";
import { SubidorFotos } from "./subidor-fotos";
import { PanelComentarios } from "./panel-comentarios";
import { Paginacion } from "@/components/paginacion";
import type { RespuestaPaginada } from "@/types/paginacion";
import { IconoAlerta, IconoCamara, IconoMensaje } from "./ui/iconos-campo";
import { VisitaRepositor } from "./visita-repositor";
import type {
  AgendaCampo,
  LocalCampo,
  TareaJornadaCampo,
  TareasDeAsignacion,
  VisitaCampo,
} from "@/types/campo";
import { ModalNovedadLocal } from "./modal-novedad-local";

// Leaflet solo se descarga al abrir un mapa.
const MapaLocal = dynamic(
  () => import("./mapa-local").then((modulo) => modulo.MapaLocal),
  { ssr: false },
);

// La API acepta hasta 50 asignaciones por pedido.
const ASIGNACIONES_POR_PEDIDO = 50;

export function TareasImpulsadorPanel({
  esRepositor = false,
}: {
  esRepositor?: boolean;
}) {
  const { usuario, modulos } = usePanel();
  const rutaInventario = modulos.some(
    (m) => m.ruta === "mi-jornada" && m.paginas.some((p) => p.ruta === "inventario"),
  )
    ? "/panel/mi-jornada/inventario"
    : null;
  const [mapaLocal, setMapaLocal] = useState<LocalCampo | null>(null);
  const hoyStr = useFechaCampo();
  const [periodo, setPeriodo] = useState<PeriodoFiltro>({
    clave: "hoy",
    etiqueta: "Hoy",
    fecha: hoyStr,
    fechaInicio: hoyStr,
    fechaFin: hoyStr,
  });
  const qsFecha = periodo.clave === "hoy" ? `fecha=${hoyStr}` : queryFechasCampo(periodo) || `fecha=${hoyStr}`;
  const [revision, setRevision] = useState(0);
  const jornada = useJornadaCompleta<AgendaCampo>(qsFecha, revision);
  const agendas = jornada.items;
  const [visitaAbierta, setAbierta] = useState<VisitaCampo | null>(null);
  const abierta = visitaAbierta?.fecha.slice(0, 10) === hoyStr ? visitaAbierta : null;
  const [consultaTerminada, setConsultaTerminada] = useState("");
  const [paginasTareas, setPaginasTareas] = useState<Record<number, number>>(
    {},
  );
  const [limitesTareas, setLimitesTareas] = useState<Record<number, number>>(
    {},
  );
  const [error, setError] = useState("");

  // Modal para fotos
  const [fotoModal, setFotoModal] = useState<{
    visitaId: number;
    tareaId: number;
    nombreTarea: string;
    obligatorio: boolean;
  } | null>(null);

  // Modal para comentarios
  const [comentarioModal, setComentarioModal] = useState<{
    visitaId: number;
    tareaId: number;
    nombreTarea: string;
  } | null>(null);

  // Modal para reportar novedad en tarea
  const [novedadTarea, setNovedadTarea] = useState<{
    localId: string;
    tareaId: number;
    nombreTarea: string;
  } | null>(null);
  const [errorAccion, setErrorAccion] = useState("");

  // Tareas por local
  const [tareasPorLocal, setTareasPorLocal] = useState<
    Record<number, RespuestaPaginada<TareaJornadaCampo>>
  >({});
  const [completandoId, setCompletandoId] = useState<number | null>(null);

  const idsAgenda = agendas.map((ag) => ag.id).join(",");
  const consulta = JSON.stringify([
    qsFecha,
    idsAgenda,
    paginasTareas,
    limitesTareas,
    revision,
  ]);
  const cargando = jornada.cargando || consulta !== consultaTerminada;
  const cargarDatos = useCallback(() => setRevision((n) => n + 1), []);
  // Páginas ya cargadas: al paginar un local solo se pide ese local, no toda
  // la ruta. Se vacía al cambiar la fecha o al recargar.
  const cacheTareas = useRef<{
    base: string;
    abierta: VisitaCampo | null;
    paginas: Map<string, RespuestaPaginada<TareaJornadaCampo>>;
  } | null>(null);
  useEffect(() => {
    if (jornada.cargando) return;
    let vigente = true;
    async function cargar() {
      try {
        const base = `${revision}|${qsFecha}|${idsAgenda}`;
        let cache = cacheTareas.current;
        if (cache?.base !== base) {
          const abiertaNueva = await apiFetch<VisitaCampo | null>(
            "/campo/jornada/abierta",
          );
          cache = { base, abierta: abiertaNueva, paginas: new Map() };
          cacheTareas.current = cache;
        }
        const { abierta: dataAbierta, paginas } = cache;
        const limiteDefecto = esRepositor ? 50 : 7;
        const pagina = (ag: AgendaCampo) => paginasTareas[ag.id] ?? 1;
        const limite = (ag: AgendaCampo) => limitesTareas[ag.id] ?? limiteDefecto;
        const clave = (ag: AgendaCampo) => `${ag.id}|${pagina(ag)}|${limite(ag)}`;
        // Con visita abierta el repositor solo trabaja ese local; sin visita
        // puede leer las tareas de todos sus locales del día.
        const visibles = agendas.filter(
          (ag) =>
            !esRepositor || !dataAbierta || ag.id === dataAbierta.asignacionId,
        );
        const faltantes = visibles.filter((ag) => !paginas.has(clave(ag)));
        // La primera página de cada local va en un solo pedido; las páginas
        // que eligió el usuario se piden por local.
        const enLote = faltantes.filter(
          (ag) => pagina(ag) === 1 && limite(ag) === limiteDefecto,
        );
        const sueltas = faltantes.filter((ag) => !enLote.includes(ag));
        const lotes: AgendaCampo[][] = [];
        for (let i = 0; i < enLote.length; i += ASIGNACIONES_POR_PEDIDO)
          lotes.push(enLote.slice(i, i + ASIGNACIONES_POR_PEDIDO));
        const [respuestasLote, respuestasSueltas] = await Promise.all([
          Promise.all(
            lotes.map((lote) =>
              apiFetch<{ items: TareasDeAsignacion[] }>(
                `/campo/jornada/tareas?${qsFecha}&asignaciones=${lote.map((ag) => ag.id).join(",")}&page=1&limit=${limiteDefecto}`,
              ),
            ),
          ),
          Promise.all(
            sueltas.map(async (ag) => {
              const datos = await apiFetch<RespuestaPaginada<TareaJornadaCampo>>(
                `/campo/jornada/asignaciones/${ag.id}/tareas?${qsFecha}&page=${pagina(ag)}&limit=${limite(ag)}`,
              );
              return [ag, datos] as const;
            }),
          ),
        ]);
        for (const { asignacionId, ...datos } of respuestasLote.flatMap(
          (r) => r.items,
        ))
          paginas.set(`${asignacionId}|1|${limiteDefecto}`, datos);
        for (const [ag, datos] of respuestasSueltas) paginas.set(clave(ag), datos);
        if (!vigente) return;
        setAbierta(dataAbierta);
        setTareasPorLocal(
          Object.fromEntries(
            visibles.flatMap((ag) => {
              const datos = paginas.get(clave(ag));
              return datos ? [[ag.id, datos] as const] : [];
            }),
          ),
        );
        setError(jornada.error ?? "");
      } catch (e) {
        if (vigente)
          setError(e instanceof Error ? e.message : "Error al cargar tareas");
      } finally {
        if (vigente) setConsultaTerminada(consulta);
      }
    }
    void cargar();
    return () => {
      vigente = false;
    };
  }, [
    jornada.cargando,
    jornada.error,
    qsFecha,
    idsAgenda,
    paginasTareas,
    limitesTareas,
    revision,
    consulta,
    agendas,
    esRepositor,
  ]);

  // Completar tarea
  const iniciarTarea = async (localId: string, tareaId: number) => {
    if (!abierta || abierta.local.id !== localId || completandoId) return;
    setCompletandoId(tareaId);
    setErrorAccion("");
    try {
      const r = await enviarAccionTarea(
        usuario.id,
        `/campo/jornada/visitas/${abierta.id}/tareas/${tareaId}/iniciar`,
        "Inicio de tarea",
      );
      if (r.pendiente)
        mostrarToast(
          "exito",
          "Inicio guardado en el dispositivo, pendiente de envío",
        );
      else cargarDatos();
    } catch (e) {
      setErrorAccion(
        e instanceof Error ? e.message : "No se pudo iniciar la tarea",
      );
    } finally {
      setCompletandoId(null);
    }
  };
  const completarTarea = async (localId: string, tareaId: number) => {
    if (!abierta || abierta.local.id !== localId || completandoId) return;
    try {
      setCompletandoId(tareaId);
      setErrorAccion("");
      const resultado = await enviarAccionTarea(
        usuario.id,
        `/campo/jornada/visitas/${abierta.id}/tareas/${tareaId}`,
        "Completar tarea",
      );
      if (resultado.pendiente) {
        mostrarToast(
          "exito",
          "Acción guardada en el dispositivo; la tarea aún está pendiente de confirmar",
        );
        return;
      }
      // Recargar tareas
      await cargarDatos();
    } catch (e: unknown) {
      setErrorAccion(
        e instanceof Error ? e.message : "No se pudo completar la tarea",
      );
    } finally {
      setCompletandoId(null);
    }
  };


  // Visita abierta de hoy (vista del repositor)
  const agendaVisita = abierta
    ? (agendas.find((ag) => ag.id === abierta.asignacionId) ?? null)
    : null;

  // Métricas globales
  const todasLasTareas = Object.values(tareasPorLocal).flatMap(
    (datos) => datos.items,
  );
  const total = todasLasTareas.length;
  const completadas = Object.entries(tareasPorLocal).reduce(
    (cantidad, [asignacionId, datos]) =>
      cantidad +
      datos.items.filter((t) =>
        tareaCumplidaEnVisita(
          t,
          abierta?.asignacionId === Number(asignacionId)
            ? abierta.id
            : undefined,
        ),
      ).length,
    0,
  );
  const pct = total ? Math.round((completadas / total) * 100) : 0;
  const obligatoriasPendientes = Object.entries(tareasPorLocal).reduce(
    (cantidad, [asignacionId, datos]) =>
      cantidad +
      datos.items.filter(
        (t) =>
          t.fotosObligatorias &&
          !tareaCumplidaEnVisita(
            t,
            abierta?.asignacionId === Number(asignacionId)
              ? abierta.id
              : undefined,
          ),
      ).length,
    0,
  );

  return (
    <div
      className="campo-screen min-w-0 w-full min-h-[calc(100vh-5rem)] flex flex-col font-sans"
      style={{
        background: TOKENS.bone,
        color: TOKENS.ink,
      }}
    >
      <div className="px-4 pt-3 sm:px-6">
        <PendientesTareas onSincronizar={cargarDatos} />
      </div>
      {esRepositor ? (
        <div className="w-full min-w-0 px-4 py-3 sm:px-6 sm:py-5">
          {errorAccion || error ? (
            <p
              role="alert"
              className="mx-auto mb-3 max-w-2xl rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200"
            >
              {errorAccion || error}
            </p>
          ) : null}
          <VisitaRepositor
            agenda={agendaVisita}
            visita={agendaVisita ? abierta : null}
            tareas={agendaVisita ? (tareasPorLocal[agendaVisita.id] ?? null) : null}
            agendas={agendas}
            tareasPorLocal={tareasPorLocal}
            cargando={cargando}
            ocupadoId={completandoId}
            rutaMiRuta="/panel/mi-jornada/locales"
            rutaInventario={rutaInventario}
            onIniciar={(tareaId) =>
              agendaVisita && void iniciarTarea(agendaVisita.local.id, tareaId)
            }
            onCompletar={(tareaId) =>
              agendaVisita && void completarTarea(agendaVisita.local.id, tareaId)
            }
            onFotos={(t) =>
              abierta &&
              setFotoModal({
                visitaId: abierta.id,
                tareaId: t.id,
                nombreTarea: t.nombre,
                obligatorio: t.fotosObligatorias,
              })
            }
            onComentarios={(t) =>
              abierta &&
              setComentarioModal({
                visitaId: abierta.id,
                tareaId: t.id,
                nombreTarea: t.nombre,
              })
            }
            onNovedad={(t) => {
              if (!agendaVisita) return;
              setNovedadTarea({
                localId: agendaVisita.local.id,
                tareaId: t.id,
                nombreTarea: t.nombre,
              });
            }}
            onMapa={(ag) => setMapaLocal(ag.local)}
            paginacion={
              agendaVisita &&
              (tareasPorLocal[agendaVisita.id]?.totalPages ?? 1) > 1 ? (
                <Paginacion
                  page={tareasPorLocal[agendaVisita.id]?.page ?? 1}
                  limit={limitesTareas[agendaVisita.id] ?? 50}
                  total={tareasPorLocal[agendaVisita.id]?.total ?? 0}
                  totalPages={tareasPorLocal[agendaVisita.id]?.totalPages ?? 1}
                  onPageChange={(n) =>
                    setPaginasTareas((p) => ({ ...p, [agendaVisita.id]: n }))
                  }
                  onLimitChange={(n) => {
                    setLimitesTareas((p) => ({ ...p, [agendaVisita.id]: n }));
                    setPaginasTareas((p) => ({ ...p, [agendaVisita.id]: 1 }));
                  }}
                />
              ) : null
            }
          />
        </div>
      ) : (
        <>
      <TopBar
        title="Mis tareas"
        subtitle="Cumplimiento y registro de actividades operativas"
        right={
          <SelectorFechaFiltro
            valorActual={periodo}
            onChange={(siguiente) => {
              setPeriodo(siguiente);
              setPaginasTareas({});
            }}
          />
        }
      />

      <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto w-full min-w-0 space-y-3 sm:space-y-6 flex-1 overflow-y-auto">
        {/* StatChips de Tareas */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 sm:grid sm:grid-cols-3 sm:overflow-visible">
          <StatChip label="Tareas visibles" value={total} tone="ink" />
          <StatChip label="Completadas" value={completadas} tone="fresco" />
          <StatChip label="Avance" value={`${pct}%`} tone="frio" />
        </div>

        {obligatoriasPendientes > 0 && (
          <p className="flex items-center gap-2 text-xs text-red-700 dark:text-red-300">
            <IconoAlerta className="h-4 w-4 shrink-0" />
            <span>
              {obligatoriasPendientes} tareas visibles con fotos obligatorias
              pendientes.
            </span>
          </p>
        )}

        {errorAccion && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200"
          >
            {errorAccion}
          </p>
        )}
        {cargando ? (
          <div className="py-12 text-center text-xs text-muted">
            Cargando tus tareas…
          </div>
        ) : error ? (
          <div
            role="alert"
            className="p-4 rounded-lg bg-red-50 text-red-700 text-xs dark:bg-red-950 dark:text-red-200"
          >
            {error}
          </div>
        ) : agendas.length === 0 ? (
          <div
            className="rounded-lg p-8 text-center"
            style={{
              background: TOKENS.canvas,
              border: `1px solid ${TOKENS.line}`,
            }}
          >
            <p className="ft-body text-xs text-muted">
              No tenés locales asignados para hoy.
            </p>
          </div>
        ) : (
          /* Tareas agrupadas por local de visita */
          agendas.map((ag) => {
            const datosTareas = tareasPorLocal[ag.id];
            const tareas = datosTareas?.items ?? [];
            const totalTareas = datosTareas?.total ?? 0;
            const totalPaginasTareas = datosTareas?.totalPages ?? 1;
            const estaEnVisita = abierta?.asignacionId === ag.id;

            return (
              <div
                key={ag.id}
                data-inicio-listado
                className="scroll-mt-20 rounded-lg p-4 space-y-3"
                style={{
                  background: TOKENS.canvas,
                  border: `1px solid ${estaEnVisita ? TOKENS.frio : TOKENS.line}`,
                }}
              >
                <div
                  className="flex flex-wrap items-center justify-between gap-2 border-b pb-2"
                  style={{ borderColor: TOKENS.line }}
                >
                  <div className="min-w-0">
                    <h3 className="ft-body break-words font-bold text-sm text-foreground">
                      {ag.local.nombre}
                    </h3>
                    <p className="ft-body text-xs text-muted">
                      {ag.local.direccion || ag.local.id}
                    </p>
                  </div>
                  {estaEnVisita ? (
                    <StatusStamp tone="frio">EN VISITA</StatusStamp>
                  ) : (
                    <span className="text-[11px] text-muted ft-body">
                      {RUTA[ag.estado].etiqueta}
                    </span>
                  )}
                </div>

                {tareas.length === 0 ? (
                  <p className="ft-body text-xs text-muted italic">
                    {esRepositor && !estaEnVisita
                      ? "Registrá entrada en este local para ver las tareas asignadas."
                      : "No hay tareas configuradas para este local."}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {tareas.map((t) => {
                      const cumplida = tareaCumplidaEnVisita(
                        t,
                        estaEnVisita ? abierta!.id : undefined,
                      );

                      return (
                        <div
                          key={t.id}
                          className="p-3 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                          style={{
                            borderColor: cumplida ? TOKENS.fresco : TOKENS.line,
                            background: cumplida
                              ? `color-mix(in srgb, ${TOKENS.fresco} 8%, ${TOKENS.canvas})`
                              : TOKENS.canvas,
                          }}
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="ft-body break-words font-semibold text-sm text-foreground">
                                {t.nombre}
                              </p>
                              {t.fotosObligatorias && (
                                <span className="px-1.5 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-700">
                                  Fotos obligatorias
                                </span>
                              )}
                            </div>
                            {t.descripcion && (
                              <p className="ft-body break-words text-xs text-muted mt-0.5 leading-snug">
                                {t.descripcion}
                              </p>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                            {/* Botón Novedad sobre la tarea */}
                            <button
                              type="button"
                              onClick={() => {
                                setNovedadTarea({
                                  localId: ag.local.id,
                                  tareaId: t.id,
                                  nombreTarea: t.nombre,
                                });
                              }}
                              className="inline-flex min-h-11 items-center cursor-pointer rounded border border-accent-ink bg-accent-soft px-3 py-2 text-xs font-medium text-accent-ink transition-colors hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                              title="Reportar novedad sobre esta tarea"
                            >
                              Novedad
                            </button>

                            {/* Botón Fotos si la tarea las admite */}
                            {t.requiereFotos && abierta && estaEnVisita && (
                              <button
                                type="button"
                                onClick={() =>
                                  setFotoModal({
                                    visitaId: abierta.id,
                                    tareaId: t.id,
                                    nombreTarea: t.nombre,
                                    obligatorio: t.fotosObligatorias,
                                  })
                                }
                                className="min-h-11 px-3 py-2 rounded text-xs font-medium border border-line bg-surface-raised hover:bg-surface-soft transition-colors cursor-pointer inline-flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                              >
                                <IconoCamara className="w-3 h-3" />
                                <span>Fotos</span>
                              </button>
                            )}

                            {/* Botón Comentarios */}
                            {abierta && estaEnVisita && (
                              <button
                                type="button"
                                onClick={() =>
                                  setComentarioModal({
                                    visitaId: abierta.id,
                                    tareaId: t.id,
                                    nombreTarea: t.nombre,
                                  })
                                }
                                className="min-h-11 px-3 py-2 rounded text-xs font-medium border border-line bg-surface-raised hover:bg-surface-soft transition-colors cursor-pointer inline-flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                              >
                                <IconoMensaje className="w-3 h-3" />
                                <span>Comentarios</span>
                              </button>
                            )}

                            {/* Estado y Acción Completar */}
                            {!cumplida && estaEnVisita ? (
                              t.iniciadaAt ? (
                                <StatusStamp tone="carne">EN CURSO</StatusStamp>
                              ) : (
                                <button
                                  type="button"
                                  disabled={completandoId !== null}
                                  onClick={() =>
                                    void iniciarTarea(ag.local.id, t.id)
                                  }
                                  className="min-h-11 rounded-lg border border-line px-3 text-xs font-semibold text-foreground hover:bg-surface-soft disabled:opacity-50"
                                >
                                  Empezar tarea
                                </button>
                              )
                            ) : null}
                            {cumplida ? (
                              <StatusStamp tone="fresco">CUMPLIDA</StatusStamp>
                            ) : estaEnVisita ? (
                              <button
                                type="button"
                                disabled={completandoId === t.id}
                                onClick={() =>
                                  completarTarea(ag.local.id, t.id)
                                }
                                className="min-h-11 px-3 py-2 rounded text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 transition-colors disabled:opacity-50 disabled:cursor-wait cursor-pointer shadow-sm dark:bg-emerald-700 dark:text-white dark:hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                              >
                                {completandoId === t.id
                                  ? "Guardando…"
                                  : "Completar"}
                              </button>
                            ) : (
                              <span className="text-[11px] text-muted italic">
                                Registrá entrada para completar
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {totalPaginasTareas > 1 && (
                  <div className="border-t border-line pt-3">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
                      Tareas de este local
                    </p>
                    <Paginacion
                      page={datosTareas?.page ?? 1}
                      limit={limitesTareas[ag.id] ?? 7}
                      total={totalTareas}
                      totalPages={totalPaginasTareas}
                      onPageChange={(n) =>
                        setPaginasTareas((p) => ({ ...p, [ag.id]: n }))
                      }
                      onLimitChange={(n) => {
                        setLimitesTareas((p) => ({ ...p, [ag.id]: n }));
                        setPaginasTareas((p) => ({ ...p, [ag.id]: 1 }));
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })
        )}
        {jornada.error ? (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
          >
            {jornada.error}
          </p>
        ) : null}
      </div>
        </>
      )}
      <PantallaCarga visible={!!completandoId} mensaje="Completando tarea" />

      {mapaLocal ? (
        <MapaLocal local={mapaLocal} cerrar={() => setMapaLocal(null)} />
      ) : null}

      {/* Modal de Fotos */}
      {fotoModal && (
        <Modal
          titulo={`Fotos · ${fotoModal.nombreTarea}`}
          abierto={!!fotoModal}
          onCerrar={() => setFotoModal(null)}
          ancho="md"
        >
          <SubidorFotos
            key={`${fotoModal.visitaId}-${fotoModal.tareaId}`}
            visitaId={fotoModal.visitaId}
            tareaId={fotoModal.tareaId}
            obligatorio={fotoModal.obligatorio}
            onFotosActualizadas={() => void cargarDatos()}
          />
        </Modal>
      )}

      {/* Modal de Comentarios */}
      {comentarioModal && (
        <Modal
          titulo={`Comentarios · ${comentarioModal.nombreTarea}`}
          abierto={!!comentarioModal}
          onCerrar={() => setComentarioModal(null)}
          ancho="md"
        >
          <PanelComentarios
            visitaId={comentarioModal.visitaId}
            tareaId={comentarioModal.tareaId}
          />
        </Modal>
      )}

      {/* Modal Reportar Novedad sobre Tarea */}
      {novedadTarea ? (
        <ModalNovedadLocal
          local={{
            id: novedadTarea.localId,
            nombre:
              agendas.find((ag) => ag.local.id === novedadTarea.localId)?.local
                .nombre ?? "Local",
          }}
          tarea={{ id: novedadTarea.tareaId, nombre: novedadTarea.nombreTarea }}
          visitaId={
            abierta?.local.id === novedadTarea.localId ? abierta.id : undefined
          }
          cerrar={() => setNovedadTarea(null)}
        />
      ) : null}
    </div>
  );
}
