"use client";

import React, { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { fechaEnZonaIso } from "@/utils/fechas";
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
import type {
  AgendaCampo,
  TareaJornadaCampo,
  VisitaCampo,
  TipoNovedad,
} from "@/types/campo";

export function TareasImpulsadorPanel() {
  const hoyStr = fechaEnZonaIso(new Date());
  const [periodo, setPeriodo] = useState<PeriodoFiltro>({
    clave: "hoy",
    etiqueta: "Hoy",
    fecha: hoyStr,
    fechaInicio: hoyStr,
    fechaFin: hoyStr,
  });
  const fecha = periodo.fecha ?? periodo.fechaFin ?? periodo.fechaInicio ?? hoyStr;
  const [agendas, setAgendas] = useState<AgendaCampo[]>([]);
  const [abierta, setAbierta] = useState<VisitaCampo | null>(null);
  const [revision, setRevision] = useState(0);
  const [consultaTerminada, setConsultaTerminada] = useState("");
  const [pagina, setPagina] = useState(1);
  const [limite, setLimite] = useState(7);
  const [paginasTareas, setPaginasTareas] = useState<Record<number, number>>({});
  const [limitesTareas, setLimitesTareas] = useState<Record<number, number>>({});
  const [paginacion, setPaginacion] = useState({ total: 0, totalPages: 1 });
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
    localId: number;
    tareaId: number;
    nombreTarea: string;
  } | null>(null);
  const [tipoNovedad, setTipoNovedad] = useState<TipoNovedad>("INCIDENCIA");
  const [tituloNovedad, setTituloNovedad] = useState("");
  const [descNovedad, setDescNovedad] = useState("");
  const [guardandoNovedad, setGuardandoNovedad] = useState(false);
  const [novedadExito, setNovedadExito] = useState(false);
  const [errorNovedad, setErrorNovedad] = useState("");
  const [errorAccion, setErrorAccion] = useState("");

  // Tareas por local
  const [tareasPorLocal, setTareasPorLocal] = useState<Record<number, RespuestaPaginada<TareaJornadaCampo>>>({});
  const [completandoId, setCompletandoId] = useState<number | null>(null);

  const consulta = JSON.stringify([fecha, pagina, limite, paginasTareas, limitesTareas, revision]);
  const cargando = consulta !== consultaTerminada;
  const cargarDatos = () => setRevision((n) => n + 1);
  useEffect(() => {
    let vigente = true;
    async function cargar() {
      try {
        const [dataAgenda, dataAbierta] = await Promise.all([
          apiFetch<RespuestaPaginada<AgendaCampo>>(`/campo/jornada?fecha=${fecha}&page=${pagina}&limit=${limite}`),
          apiFetch<VisitaCampo | null>("/campo/jornada/abierta"),
        ]);
        const tareas = await Promise.all(dataAgenda.items.map(async (ag) => {
          const datos = await apiFetch<RespuestaPaginada<TareaJornadaCampo>>(`/campo/jornada/asignaciones/${ag.id}/tareas?fecha=${fecha}&page=${paginasTareas[ag.id] ?? 1}&limit=${limitesTareas[ag.id] ?? 7}`);
          return [ag.id, datos] as const;
        }));
        if (!vigente) return;
        setAgendas(dataAgenda.items);
        setPaginacion({ total: dataAgenda.total, totalPages: dataAgenda.totalPages });
        setAbierta(dataAbierta);
        setTareasPorLocal(Object.fromEntries(tareas));
        setError("");
      } catch (e) {
        if (vigente) setError(e instanceof Error ? e.message : "Error al cargar tareas");
      } finally {
        if (vigente) setConsultaTerminada(consulta);
      }
    }
    void cargar();
    return () => { vigente = false; };
  }, [fecha, pagina, limite, paginasTareas, limitesTareas, consulta]);

  // Completar tarea
  const completarTarea = async (localId: number, tareaId: number) => {
    if (!abierta || abierta.local.id !== localId || completandoId) return;
    try {
      setCompletandoId(tareaId);
      setErrorAccion("");
      await apiFetch(`/campo/jornada/visitas/${abierta.id}/tareas/${tareaId}`, {
        method: "POST",
      });
      // Recargar tareas
      await cargarDatos();
    } catch (e: unknown) {
      setErrorAccion(e instanceof Error ? e.message : "No se pudo completar la tarea");
    } finally {
      setCompletandoId(null);
    }
  };

  const enviarNovedad = async () => {
    if (!novedadTarea || !tituloNovedad.trim() || !descNovedad.trim() || guardandoNovedad) return;
    try {
      setGuardandoNovedad(true);
      setErrorNovedad("");
      await apiFetch("/campo/novedades", {
        method: "POST",
        body: JSON.stringify({
          localId: novedadTarea.localId,
          tareaId: novedadTarea.tareaId,
          tipo: tipoNovedad,
          titulo: tituloNovedad.trim(),
          descripcion: descNovedad.trim(),
          visitaId: abierta?.local.id === novedadTarea.localId ? abierta.id : undefined,
        }),
      });
      setNovedadExito(true);
      setTituloNovedad("");
      setDescNovedad("");
    } catch (e: unknown) {
      setErrorNovedad(e instanceof Error ? e.message : "No se pudo enviar la novedad");
    } finally {
      setGuardandoNovedad(false);
    }
  };

  // Métricas globales
  const todasLasTareas = Object.values(tareasPorLocal).flatMap((datos) => datos.items);
  const total = todasLasTareas.length;
  const completadas = todasLasTareas.filter((t) => (t.visitasCompletadas?.length ?? 0) > 0).length;
  const pct = total ? Math.round((completadas / total) * 100) : 0;
  const obligatoriasPendientes = todasLasTareas.filter(
    (t) => t.fotosObligatorias && (t.visitasCompletadas?.length ?? 0) === 0,
  ).length;

  return (
    <div
      className="campo-screen min-w-0 w-full min-h-[calc(100vh-5rem)] flex flex-col font-sans"
      style={{
        background: TOKENS.bone,
        color: TOKENS.ink,
      }}
    >
      <TopBar
        title="Mis Tareas del Día"
        subtitle="Cumplimiento y registro de actividades operativas"
        right={
          <SelectorFechaFiltro
            valorActual={periodo}
            onChange={(siguiente) => {
              setPeriodo(siguiente);
              setPagina(1);
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
            <span>{obligatoriasPendientes} tareas visibles con fotos obligatorias pendientes.</span>
          </p>
        )}

        {errorAccion && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">{errorAccion}</p>}
        {cargando ? (
          <div className="py-12 text-center text-xs text-muted">Cargando tareas del día...</div>
        ) : error ? (
          <div className="p-4 rounded-lg bg-red-50 text-red-700 text-xs">{error}</div>
        ) : agendas.length === 0 ? (
          <div
            className="rounded-lg p-8 text-center"
            style={{ background: TOKENS.canvas, border: `1px solid ${TOKENS.line}` }}
          >
            <p className="ft-body text-xs text-muted">No tenés locales asignados para hoy.</p>
          </div>
        ) : (
          /* Tareas agrupadas por local de visita */
          agendas.map((ag) => {
            const datosTareas = tareasPorLocal[ag.id];
            const tareas = datosTareas?.items ?? [];
            const totalTareas = datosTareas?.total ?? 0;
            const totalPaginasTareas = datosTareas?.totalPages ?? 1;
            const estaEnVisita = abierta?.asignacionId === ag.id && abierta.fecha.slice(0, 10) === fecha;

            return (
              <div
                key={ag.id}
                className="rounded-lg p-4 space-y-3"
                style={{
                  background: TOKENS.canvas,
                  border: `1px solid ${estaEnVisita ? TOKENS.frio : TOKENS.line}`,
                }}
              >
                <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: TOKENS.line }}>
                  <div>
                    <h3 className="ft-body font-bold text-sm text-foreground">{ag.local.nombre}</h3>
                    <p className="ft-body text-xs text-muted">{ag.local.cliente.nombre}</p>
                  </div>
                  {estaEnVisita ? (
                    <StatusStamp tone="frio">EN VISITA</StatusStamp>
                  ) : (
                    <span className="text-[11px] text-muted ft-body">
                      {ag.visitas.some((v) => v.salida) ? "Visita finalizada" : "Pendiente de visita"}
                    </span>
                  )}
                </div>

                {tareas.length === 0 ? (
                  <p className="ft-body text-xs text-muted italic">No hay tareas configuradas para este local.</p>
                ) : (
                  <div className="space-y-2">
                    {tareas.map((t) => {
                      const cumplida = abierta && t.visitasCompletadas?.includes(abierta.id);
                      const cumplidaAlgunaVez = (t.visitasCompletadas?.length ?? 0) > 0;

                      return (
                        <div
                          key={t.id}
                          className="p-3 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                          style={{
                            borderColor: cumplida || cumplidaAlgunaVez ? TOKENS.fresco : TOKENS.line,
                            background: cumplida || cumplidaAlgunaVez ? `color-mix(in srgb, ${TOKENS.fresco} 8%, ${TOKENS.canvas})` : TOKENS.canvas,
                          }}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="ft-body font-semibold text-sm text-foreground">{t.nombre}</p>
                              {t.fotosObligatorias && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                  Fotos obligatorias
                                </span>
                              )}
                            </div>
                            {t.descripcion && (
                              <p className="ft-body text-[11px] text-muted mt-0.5 leading-snug">{t.descripcion}</p>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                            {/* Botón Novedad sobre la tarea */}
                            <button
                              type="button"
                              onClick={() => {
                                setNovedadExito(false);
                                setErrorNovedad("");
                                setNovedadTarea({
                                  localId: ag.local.id,
                                  tareaId: t.id,
                                  nombreTarea: t.nombre,
                                });
                              }}
                              className="cursor-pointer rounded border border-accent-ink bg-accent-soft px-2 py-1 text-[11px] font-medium text-accent-ink transition hover:bg-surface-soft"
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
                                className="px-2.5 py-1 rounded text-[11px] font-medium border border-line bg-surface-raised hover:bg-surface-soft transition cursor-pointer inline-flex items-center gap-1"
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
                                className="px-2 py-1 rounded text-[11px] font-medium border border-line bg-surface-raised hover:bg-surface-soft transition cursor-pointer inline-flex items-center gap-1"
                              >
                                <IconoMensaje className="w-3 h-3" />
                                <span>Comentarios</span>
                              </button>
                            )}

                            {/* Estado y Acción Completar */}
                            {cumplida || cumplidaAlgunaVez ? (
                              <StatusStamp tone="fresco">CUMPLIDA</StatusStamp>
                            ) : estaEnVisita ? (
                              <button
                                type="button"
                                disabled={completandoId === t.id}
                                onClick={() => completarTarea(ag.local.id, t.id)}
                                className="px-3 py-1 rounded text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 transition disabled:opacity-50 cursor-pointer shadow-sm"
                              >
                                {completandoId === t.id ? "Guardando..." : "Completar"}
                              </button>
                            ) : (
                              <span className="text-[11px] text-muted italic">Check-in requerido</span>
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
                      onPageChange={(n) => setPaginasTareas((p) => ({ ...p, [ag.id]: n }))}
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
        {paginacion.totalPages > 1 && (
          <div className="border-t border-line pt-3">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
              Locales de la ruta
            </p>
            <Paginacion
              page={pagina}
              limit={limite}
              total={paginacion.total}
              totalPages={paginacion.totalPages}
              onPageChange={setPagina}
              onLimitChange={(n) => {
                setLimite(n);
                setPagina(1);
              }}
            />
          </div>
        )}
      </div>
      <PantallaCarga visible={!!completandoId || guardandoNovedad} mensaje={guardandoNovedad ? "Enviando novedad" : "Completando tarea"} />

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
          <PanelComentarios visitaId={comentarioModal.visitaId} tareaId={comentarioModal.tareaId} />
        </Modal>
      )}

      {/* Modal Reportar Novedad sobre Tarea */}
      {novedadTarea && (
        <Modal
          titulo={`Reportar Novedad · ${novedadTarea.nombreTarea}`}
          abierto={!!novedadTarea}
          onCerrar={() => { if (!guardandoNovedad) setNovedadTarea(null); }}
          ancho="md"
        >
          {novedadExito ? (
            <div className="py-6 text-center text-emerald-700 space-y-2">
              <p className="ft-display text-xl font-bold">¡Novedad enviada con éxito!</p>
              <p className="ft-body text-xs text-muted">Tu reporte quedó registrado para el equipo.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {errorNovedad && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">{errorNovedad}</p>}
              <p className="ft-body text-xs text-muted">
                Detallá el motivo o inconveniente para realizar la tarea «{novedadTarea.nombreTarea}».
              </p>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Tipo:</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {(["INCIDENCIA", "RECLAMO", "CONSULTA", "SUGERENCIA"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTipoNovedad(t)}
                      className={`py-1.5 px-2 rounded-md text-xs font-semibold border transition cursor-pointer ${
                        tipoNovedad === t ? "bg-zinc-900 text-white border-zinc-900" : "bg-surface-raised text-foreground border-line"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Asunto:</label>
                <input
                  type="text"
                  value={tituloNovedad}
                  onChange={(e) => setTituloNovedad(e.target.value)}
                  placeholder="Ej: Falta de stock para reposición"
                  className="w-full text-xs p-2.5 rounded-lg border border-line bg-surface-raised outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Descripción detallada:</label>
                <textarea
                  value={descNovedad}
                  onChange={(e) => setDescNovedad(e.target.value)}
                  rows={3}
                  placeholder="Detallá el motivo..."
                  className="w-full text-xs p-2.5 rounded-lg border border-line bg-surface-raised outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setNovedadTarea(null)}
                  className="flex-1 py-2 text-xs font-semibold border rounded-lg text-foreground"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={enviarNovedad}
                  disabled={!tituloNovedad.trim() || !descNovedad.trim() || guardandoNovedad}
                  className="flex-1 py-2 text-xs font-bold bg-[#1E2320] text-white rounded-lg hover:bg-black transition disabled:opacity-50 cursor-pointer"
                >
                  {guardandoNovedad ? "Enviando..." : "Enviar Novedad"}
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
