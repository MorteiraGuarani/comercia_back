"use client";

import React, { useEffect, useState, useMemo } from "react";
import { apiFetch } from "@/lib/api";
import { fechaEnZonaIso } from "@/utils/fechas";
import { TOKENS } from "./tokens";
import { StatusStamp } from "./ui/status-stamp";
import { StatChip } from "./ui/stat-chip";
import { BigProgress } from "./ui/big-progress";
import { TopBar } from "./ui/top-bar";
import { Modal } from "@/components/modal";
import { PantallaCarga } from "@/components/pantalla-carga";
import { SubidorFotos } from "./subidor-fotos";
import { PanelComentarios } from "./panel-comentarios";
import { IconoAlerta, IconoCamara, IconoMensaje } from "./ui/iconos-campo";
import type {
  AgendaCampo,
  TareaJornadaCampo,
  VisitaCampo,
  TipoNovedad,
} from "@/types/campo";

export function TareasImpulsadorPanel() {
  const [fecha, setFecha] = useState(fechaEnZonaIso(new Date()));
  const [agendas, setAgendas] = useState<AgendaCampo[]>([]);
  const [abierta, setAbierta] = useState<VisitaCampo | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  // Modal para fotos
  const [fotoModal, setFotoModal] = useState<{
    visitaId: number;
    tareaId: number;
    nombreTarea: string;
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

  // Tareas por local
  const [tareasPorLocal, setTareasPorLocal] = useState<Record<number, TareaJornadaCampo[]>>({});
  const [completandoId, setCompletandoId] = useState<number | null>(null);

  const cargarDatos = async () => {
    try {
      setCargando(true);
      setError("");
      const [dataAgenda, dataAbierta] = await Promise.all([
        apiFetch<{ items: AgendaCampo[] }>(`/campo/jornada?fecha=${fecha}`),
        apiFetch<VisitaCampo | null>("/campo/jornada/abierta").catch(() => null),
      ]);
      setAgendas(dataAgenda.items);
      setAbierta(dataAbierta);

      // Cargar tareas para cada local asignado
      const tareasMap: Record<number, TareaJornadaCampo[]> = {};
      await Promise.all(
        dataAgenda.items.map(async (ag) => {
          try {
            const res = await apiFetch<{ items: TareaJornadaCampo[] }>(
              `/campo/jornada/asignaciones/${ag.id}/tareas?fecha=${fecha}`,
            );
            tareasMap[ag.local.id] = res.items;
          } catch {
            tareasMap[ag.local.id] = [];
          }
        }),
      );
      setTareasPorLocal(tareasMap);
    } catch (e: any) {
      setError(e.message ?? "Error al cargar tareas");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, [fecha]);

  // Completar tarea
  const completarTarea = async (localId: number, tareaId: number) => {
    if (!abierta || abierta.local.id !== localId || completandoId) return;
    try {
      setCompletandoId(tareaId);
      await apiFetch(`/campo/jornada/visitas/${abierta.id}/tareas/${tareaId}`, {
        method: "POST",
      });
      // Recargar tareas
      await cargarDatos();
    } catch (e: any) {
      alert("Error al completar tarea: " + e.message);
    } finally {
      setCompletandoId(null);
    }
  };

  const enviarNovedad = async () => {
    if (!novedadTarea || !tituloNovedad.trim() || !descNovedad.trim() || guardandoNovedad) return;
    try {
      setGuardandoNovedad(true);
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
      setTimeout(() => {
        setNovedadTarea(null);
        setTituloNovedad("");
        setDescNovedad("");
        setNovedadExito(false);
      }, 1400);
    } catch (e: any) {
      alert("Error al reportar novedad: " + e.message);
    } finally {
      setGuardandoNovedad(false);
    }
  };

  // Métricas globales
  const todasLasTareas = Object.values(tareasPorLocal).flat();
  const total = todasLasTareas.length;
  const completadas = todasLasTareas.filter((t) => (t.visitasCompletadas?.length ?? 0) > 0).length;
  const pct = total ? Math.round((completadas / total) * 100) : 0;
  const obligatoriasPendientes = todasLasTareas.filter(
    (t) => t.fotosObligatorias && (t.visitasCompletadas?.length ?? 0) === 0,
  ).length;

  return (
    <div
      className="w-full min-h-[calc(100vh-5rem)] flex flex-col font-sans"
      style={{
        background: TOKENS.bone,
        color: TOKENS.ink,
      }}
    >
      <TopBar
        title="Mis Tareas del Día"
        subtitle="Cumplimiento y registro de actividades operativas"
        right={
          <div className="flex items-center gap-1.5 bg-zinc-900 px-2 py-1 rounded-md border border-zinc-700 text-xs">
            <span className="text-zinc-400">Fecha:</span>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="bg-transparent text-white ft-mono text-xs outline-none cursor-pointer"
            />
          </div>
        }
      />

      <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto w-full space-y-6 flex-1 overflow-y-auto">
        {/* StatChips de Tareas */}
        <div className="flex gap-2">
          <StatChip label="Total tareas" value={total} tone="ink" />
          <StatChip label="Completadas" value={completadas} tone="fresco" />
          <StatChip label="Cumplimiento" value={`${pct}%`} tone="frio" />
        </div>

        {/* Tarjeta de progreso global */}
        <div
          className="rounded-lg p-3.5"
          style={{ background: TOKENS.canvas, border: `1px solid ${TOKENS.line}` }}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="ft-body text-xs font-semibold text-zinc-600">Avance de hoy</span>
            <span className="ft-display text-xl font-bold" style={{ color: TOKENS.fresco }}>
              {pct}%
            </span>
          </div>
          <BigProgress pct={pct} color={TOKENS.fresco} />
          {obligatoriasPendientes > 0 && (
            <p className="ft-body text-[11px] font-semibold text-red-600 mt-2 flex items-center gap-1.5">
              <IconoAlerta className="w-3.5 h-3.5 text-red-600 shrink-0" />
              <span>Tenés {obligatoriasPendientes} tarea(s) con fotos obligatorias pendientes</span>
            </p>
          )}
        </div>

        {cargando ? (
          <div className="py-12 text-center text-xs text-zinc-500">Cargando tareas del día...</div>
        ) : error ? (
          <div className="p-4 rounded-lg bg-red-50 text-red-700 text-xs">{error}</div>
        ) : agendas.length === 0 ? (
          <div
            className="rounded-lg p-8 text-center"
            style={{ background: TOKENS.canvas, border: `1px solid ${TOKENS.line}` }}
          >
            <p className="ft-body text-xs text-zinc-500">No tenés locales asignados para hoy.</p>
          </div>
        ) : (
          /* Tareas agrupadas por local de visita */
          agendas.map((ag) => {
            const tareas = tareasPorLocal[ag.local.id] ?? [];
            const estaEnVisita = abierta?.local.id === ag.local.id;

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
                    <h3 className="ft-body font-bold text-sm text-zinc-900">{ag.local.nombre}</h3>
                    <p className="ft-body text-xs text-zinc-500">{ag.local.cliente.nombre}</p>
                  </div>
                  {estaEnVisita ? (
                    <StatusStamp tone="frio">EN VISITA</StatusStamp>
                  ) : (
                    <span className="text-[11px] text-zinc-400 ft-body">
                      {ag.visitas.some((v) => v.salida) ? "Visita finalizada" : "Pendiente de visita"}
                    </span>
                  )}
                </div>

                {tareas.length === 0 ? (
                  <p className="ft-body text-xs text-zinc-400 italic">No hay tareas configuradas para este local.</p>
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
                            background: cumplida || cumplidaAlgunaVez ? "#F2F7F2" : "#FFFFFF",
                          }}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="ft-body font-semibold text-xs text-zinc-900 truncate">{t.nombre}</p>
                              {t.fotosObligatorias && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                  Fotos obligatorias
                                </span>
                              )}
                            </div>
                            {t.descripcion && (
                              <p className="ft-body text-[11px] text-zinc-500 mt-0.5 leading-snug">{t.descripcion}</p>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                            {/* Botón Novedad sobre la tarea */}
                            <button
                              type="button"
                              onClick={() =>
                                setNovedadTarea({
                                  localId: ag.local.id,
                                  tareaId: t.id,
                                  nombreTarea: t.nombre,
                                })
                              }
                              className="px-2 py-1 rounded text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-300 hover:bg-amber-100 transition cursor-pointer"
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
                                  })
                                }
                                className="px-2.5 py-1 rounded text-[11px] font-medium border border-zinc-300 bg-white hover:bg-zinc-100 transition cursor-pointer inline-flex items-center gap-1"
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
                                className="px-2 py-1 rounded text-[11px] font-medium border border-zinc-300 bg-white hover:bg-zinc-100 transition cursor-pointer inline-flex items-center gap-1"
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
                              <span className="text-[11px] text-zinc-400 italic">Check-in requerido</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modal de Fotos */}
      {fotoModal && (
        <Modal
          titulo={`Fotos · ${fotoModal.nombreTarea}`}
          abierto={!!fotoModal}
          onCerrar={() => setFotoModal(null)}
          ancho="md"
        >
          <SubidorFotos
            visitaId={fotoModal.visitaId}
            tareaId={fotoModal.tareaId}
            obligatorio={false}
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
          onCerrar={() => setNovedadTarea(null)}
          ancho="md"
        >
          {novedadExito ? (
            <div className="py-6 text-center text-emerald-700 space-y-2">
              <p className="ft-display text-xl font-bold">¡Novedad enviada con éxito!</p>
              <p className="ft-body text-xs text-zinc-500">Tu Team Leader ya fue notificado.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="ft-body text-xs text-zinc-600">
                Detallá el motivo o inconveniente para realizar la tarea "{novedadTarea.nombreTarea}".
              </p>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Tipo:</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {(["INCIDENCIA", "RECLAMO", "CONSULTA", "SUGERENCIA"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTipoNovedad(t)}
                      className={`py-1.5 px-2 rounded-md text-xs font-semibold border transition cursor-pointer ${
                        tipoNovedad === t ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-700 border-zinc-300"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Asunto:</label>
                <input
                  type="text"
                  value={tituloNovedad}
                  onChange={(e) => setTituloNovedad(e.target.value)}
                  placeholder="Ej: Falta de stock para reposición"
                  className="w-full text-xs p-2.5 rounded-lg border border-zinc-300 bg-white outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Descripción detallada:</label>
                <textarea
                  value={descNovedad}
                  onChange={(e) => setDescNovedad(e.target.value)}
                  rows={3}
                  placeholder="Detallá el motivo..."
                  className="w-full text-xs p-2.5 rounded-lg border border-zinc-300 bg-white outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setNovedadTarea(null)}
                  className="flex-1 py-2 text-xs font-semibold border rounded-lg text-zinc-700"
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
