"use client";

import React, { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { mensajeError } from "@/utils/error";
import { TOKENS } from "./tokens";
import { StatusStamp } from "./ui/status-stamp";
import { TopBar } from "./ui/top-bar";
import { PantallaCarga } from "@/components/pantalla-carga";
import { IconoMegafono, IconoContacto, IconoCheck } from "./ui/iconos-campo";
import type {
  AvisoEnviadoItem,
  AvisoRecibidoItem,
  FormAvisoCampo,
  TipoAviso,
  ColaboradorResumenItem,
  SupervisionResumenData,
} from "@/types/campo";

interface AvisosPanelProps {
  esImpulsador?: boolean;
}

export function AvisosPanel({ esImpulsador = false }: AvisosPanelProps) {
  // Tabs: para lider: "recibidos" | "enviados" | "redactar". Para impulsador: "recibidos"
  const [tab, setTab] = useState<"recibidos" | "enviados" | "redactar">(
    esImpulsador ? "recibidos" : "enviados"
  );

  const [recibidos, setRecibidos] = useState<AvisoRecibidoItem[]>([]);
  const [enviados, setEnviados] = useState<AvisoEnviadoItem[]>([]);
  const [colaboradores, setColaboradores] = useState<ColaboradorResumenItem[]>([]);

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");

  // Estado del formulario
  const [formTipo, setFormTipo] = useState<TipoAviso>("EQUIPO");
  const [formDestinatarioId, setFormDestinatarioId] = useState<number | undefined>(undefined);
  const [formMensaje, setFormMensaje] = useState("");
  const [enviando, setEnviando] = useState(false);

  // Cargar avisos recibidos
  const cargarRecibidos = async () => {
    try {
      const res = await apiFetch<AvisoRecibidoItem[]>("/campo/avisos/recibidos");
      setRecibidos(Array.isArray(res) ? res : []);
    } catch (e: unknown) {
      console.error("Error cargando avisos recibidos:", e);
    }
  };

  // Cargar avisos enviados
  const cargarEnviados = async () => {
    try {
      const res = await apiFetch<AvisoEnviadoItem[]>("/campo/avisos/enviados");
      setEnviados(Array.isArray(res) ? res : []);
    } catch (e: unknown) {
      console.error("Error cargando avisos enviados:", e);
    }
  };

  // Cargar colaboradores para el selector individual
  const cargarColaboradores = async () => {
    if (esImpulsador) return;
    try {
      const res = await apiFetch<SupervisionResumenData>("/campo/supervision/resumen");
      if (res && res.colaboradores) {
        setColaboradores(res.colaboradores);
        if (res.colaboradores.length > 0 && !formDestinatarioId) {
          setFormDestinatarioId(res.colaboradores[0].id);
        }
      }
    } catch {
      // Ignorar si falla
    }
  };

  const inicializar = async () => {
    setCargando(true);
    setError("");
    try {
      await Promise.all([cargarRecibidos(), !esImpulsador ? cargarEnviados() : null, !esImpulsador ? cargarColaboradores() : null]);
    } catch (e) {
      setError(mensajeError(e, "Error al cargar avisos"));
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    void Promise.resolve().then(inicializar);
  }, [esImpulsador]);

  // Enviar nuevo aviso
  const handleEnviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formMensaje.trim()) return;
    if (formTipo === "INDIVIDUAL" && !formDestinatarioId) {
      setError("Debes seleccionar un colaborador para el aviso individual.");
      return;
    }

    setEnviando(true);
    setError("");
    setExito("");

    try {
      const payload: FormAvisoCampo = {
        tipo: formTipo,
        mensaje: formMensaje.trim(),
        destinatarioId: formTipo === "INDIVIDUAL" ? formDestinatarioId : undefined,
      };

      await apiFetch("/campo/avisos", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setFormMensaje("");
      setExito("Aviso transmitido con éxito al equipo de campo.");
      await cargarEnviados();
      setTab("enviados");
    } catch (err) {
      setError(mensajeError(err, "Error al enviar aviso."));
    } finally {
      setEnviando(false);
    }
  };

  // Marcar como leído
  const handleMarcarLeido = async (id: number) => {
    try {
      await apiFetch(`/campo/avisos/${id}/marcar-leido`, {
        method: "PUT",
      });
      setRecibidos((prev) =>
        prev.map((a) => (a.id === id ? { ...a, leido: true, leidoAt: new Date().toISOString() } : a))
      );
    } catch (err: unknown) {
      console.error("Error al marcar aviso como leído:", err);
    }
  };

  const formatearFecha = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString("es-PY", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  const noLeidosCount = recibidos.filter((r) => !r.leido).length;

  if (cargando) {
    return <PantallaCarga visible={cargando} mensaje="Sincronizando canal de avisos y novedades..." />;
  }

  return (
    <div
      className="campo-screen min-h-screen min-w-0 w-full text-[14px] font-sans"
      style={{ backgroundColor: TOKENS.bone, color: TOKENS.ink }}
    >
      <TopBar
        title="Canal de Avisos & Comunicados"
        subtitle={
          esImpulsador
            ? "Mensajes e instrucciones operativas de tu supervisor"
            : "Transmisión y control de comunicados a la fuerza de campo"
        }
        right={
          noLeidosCount > 0 ? (
            <span
              className="text-[11px] font-mono px-2 py-0.5 rounded-full text-white font-bold"
              style={{ backgroundColor: TOKENS.carne }}
            >
              {noLeidosCount} NUEVO{noLeidosCount > 1 ? "S" : ""}
            </span>
          ) : undefined
        }
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        {/* Banner de mensajes */}
        {error && (
          <div
            className="p-4 rounded-xl border text-base font-semibold flex items-center justify-between"
            style={{
              backgroundColor: "var(--campo-error-surface)",
              borderColor: TOKENS.critico,
              color: TOKENS.critico,
            }}
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError("")}
              className="text-sm font-bold underline ml-3 cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        )}

        {exito && (
          <div
            className="p-4 rounded-xl border text-base font-semibold flex items-center justify-between"
            style={{
              backgroundColor: "var(--campo-success-surface)",
              borderColor: TOKENS.fresco,
              color: TOKENS.fresco,
            }}
          >
            <span>{exito}</span>
            <button
              type="button"
              onClick={() => setExito("")}
              className="text-sm font-bold underline ml-3 cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        )}

        {/* Barra de navegación de pestañas (si es Team Leader) */}
        {!esImpulsador ? (
          <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4" style={{ borderColor: TOKENS.line }}>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setTab("enviados")}
                className={`px-5 py-2.5 rounded-xl text-sm font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  tab === "enviados"
                    ? "bg-[#1E2320] text-white shadow-sm"
                    : "bg-white text-[#726C60] hover:text-[#1E2320] border"
                }`}
                style={{ borderColor: tab === "enviados" ? "transparent" : TOKENS.line }}
              >
                Avisos Enviados ({enviados.length})
              </button>

              <button
                type="button"
                onClick={() => setTab("redactar")}
                className={`px-5 py-2.5 rounded-xl text-sm font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  tab === "redactar"
                    ? "bg-[#1E2320] text-white shadow-sm"
                    : "bg-white text-[#726C60] hover:text-[#1E2320] border"
                }`}
                style={{ borderColor: tab === "redactar" ? "transparent" : TOKENS.line }}
              >
                + Nuevo Comunicado
              </button>

              <button
                type="button"
                onClick={() => setTab("recibidos")}
                className={`px-5 py-2.5 rounded-xl text-sm font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
                  tab === "recibidos"
                    ? "bg-[#1E2320] text-white shadow-sm"
                    : "bg-white text-[#726C60] hover:text-[#1E2320] border"
                }`}
                style={{ borderColor: tab === "recibidos" ? "transparent" : TOKENS.line }}
              >
                <span>Bandeja Recibida</span>
                {noLeidosCount > 0 && (
                  <span
                    className="text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold text-white"
                    style={{ backgroundColor: TOKENS.carne }}
                  >
                    {noLeidosCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: TOKENS.line }}>
            <h2 className="text-xl font-bold uppercase tracking-wide ft-display">
              Mensajes y Avisos Recibidos
            </h2>
            <span className="text-xs font-mono text-[#726C60]">
              Total: {recibidos.length} | Pendientes: {noLeidosCount}
            </span>
          </div>
        )}

        {/* CONTENIDO SEGÚN PESTAÑA */}

        {/* 1. FORMULARIO DE NUEVO COMUNICADO */}
        {tab === "redactar" && !esImpulsador && (
          <div
            className="p-6 rounded-xl border shadow-sm"
            style={{ backgroundColor: TOKENS.canvas, borderColor: TOKENS.line }}
          >
            <div className="mb-5 border-b pb-3" style={{ borderColor: TOKENS.line }}>
              <h3 className="text-xl font-bold uppercase tracking-wide ft-display">
                Transmitir Comunicado a Campo
              </h3>
              <p className="text-xs text-[#726C60]">
                Envía una notificación prioritaria instantánea a todo tu equipo o a un impulsador específico.
              </p>
            </div>

            <form onSubmit={handleEnviar} className="space-y-5">
              {/* Tipo de alcance */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-[#726C60]">
                  Alcance del Mensaje
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormTipo("EQUIPO")}
                    className={`p-3.5 rounded-lg border text-left flex items-start gap-3 transition-all ${
                      formTipo === "EQUIPO"
                        ? "border-[#1E2320] bg-white shadow-sm ring-1 ring-[#1E2320]"
                        : "border-[#DAD5C9] bg-[#ECE9E2]/50 hover:bg-white"
                    }`}
                  >
                    <div
                      className="w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center"
                      style={{
                        borderColor: formTipo === "EQUIPO" ? TOKENS.ink : TOKENS.sub,
                      }}
                    >
                      {formTipo === "EQUIPO" && (
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: TOKENS.ink }}
                        />
                      )}
                    </div>
                    <div>
                      <div className="font-bold text-sm">Todo el Equipo de Campo</div>
                      <div className="text-xs text-[#726C60]">
                        Se transmite a todos los impulsadores asignados a tu supervisión.
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormTipo("INDIVIDUAL")}
                    className={`p-3.5 rounded-lg border text-left flex items-start gap-3 transition-all ${
                      formTipo === "INDIVIDUAL"
                        ? "border-[#1E2320] bg-white shadow-sm ring-1 ring-[#1E2320]"
                        : "border-[#DAD5C9] bg-[#ECE9E2]/50 hover:bg-white"
                    }`}
                  >
                    <div
                      className="w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center"
                      style={{
                        borderColor: formTipo === "INDIVIDUAL" ? TOKENS.ink : TOKENS.sub,
                      }}
                    >
                      {formTipo === "INDIVIDUAL" && (
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: TOKENS.ink }}
                        />
                      )}
                    </div>
                    <div>
                      <div className="font-bold text-sm">Colaborador Individual</div>
                      <div className="text-xs text-[#726C60]">
                        Mensaje directo a un impulsador en particular.
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Selector de colaborador (si es individual) */}
              {formTipo === "INDIVIDUAL" && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-[#726C60]">
                    Seleccionar Destinatario
                  </label>
                  <select
                    value={formDestinatarioId ?? ""}
                    onChange={(e) => setFormDestinatarioId(Number(e.target.value))}
                    className="w-full p-2.5 rounded-lg border bg-white text-sm font-sans focus:outline-none focus:ring-2 focus:ring-[#1E2320]"
                    style={{ borderColor: TOKENS.line }}
                    required
                  >
                    <option value="" disabled>
                      -- Seleccionar colaborador --
                    </option>
                    {colaboradores.map((colab) => (
                      <option key={colab.id} value={colab.id}>
                        {colab.nombre} — {colab.zona || "General"}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Mensaje */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#726C60]">
                    Texto del Comunicado
                  </label>
                  <span className="text-[11px] font-mono text-[#726C60]">
                    {formMensaje.length} caracteres
                  </span>
                </div>
                <textarea
                  rows={4}
                  value={formMensaje}
                  onChange={(e) => setFormMensaje(e.target.value)}
                  placeholder="Ej: Recordatorio urgente: priorizar reposición de la línea fresca en Superseis Los Laureles antes de las 14:00..."
                  className="w-full p-3 rounded-lg border bg-white text-sm font-sans focus:outline-none focus:ring-2 focus:ring-[#1E2320]"
                  style={{ borderColor: TOKENS.line }}
                  required
                />
              </div>

              {/* Botón de envío */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setTab("enviados")}
                  className="px-4 py-2.5 rounded-lg border text-xs font-bold uppercase tracking-wider bg-white hover:bg-gray-50"
                  style={{ borderColor: TOKENS.line }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={enviando || !formMensaje.trim()}
                  className="px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider text-white shadow-sm disabled:opacity-50 transition-all hover:brightness-110"
                  style={{ backgroundColor: TOKENS.ink }}
                >
                  {enviando ? "Transmitiendo..." : "Enviar Comunicado Ahora"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 2. BANDEJA DE AVISOS ENVIADOS (TEAM LEADER) */}
        {tab === "enviados" && !esImpulsador && (
          <div className="space-y-4">
            {enviados.length === 0 ? (
              <div
                className="p-12 text-center rounded-xl border"
                style={{ backgroundColor: TOKENS.canvas, borderColor: TOKENS.line }}
              >
                <p className="text-base font-bold text-[#1E2320] mb-1">
                  No hay avisos enviados aún
                </p>
                <p className="text-xs text-[#726C60] mb-4">
                  Envía el primer comunicado a tu equipo de impulsadores de campo.
                </p>
                <button
                  type="button"
                  onClick={() => setTab("redactar")}
                  className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider text-white"
                  style={{ backgroundColor: TOKENS.ink }}
                >
                  + Redactar Comunicado
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {enviados.map((aviso) => {
                  const total = aviso.total ?? 1;
                  const leidos = aviso.leidoPor ?? (aviso.leido ? 1 : 0);
                  const todoLeido = total > 0 && leidos >= total;
                  const parcialLeido = leidos > 0 && leidos < total;

                  return (
                    <div
                      key={aviso.id}
                      className="p-4 rounded-xl border transition-all hover:shadow-sm"
                      style={{
                        backgroundColor: TOKENS.canvas,
                        borderColor: TOKENS.line,
                      }}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="text-[10px] font-mono uppercase px-2 py-0.5 rounded font-bold inline-flex items-center gap-1"
                            style={{
                              backgroundColor:
                                aviso.tipo === "EQUIPO" ? "var(--accent-soft)" : TOKENS.bone,
                              color:
                                aviso.tipo === "EQUIPO" ? TOKENS.frio : TOKENS.carne,
                            }}
                          >
                            {aviso.tipo === "EQUIPO" ? (
                              <>
                                <IconoMegafono className="w-3 h-3" />
                                <span>TODO EL EQUIPO</span>
                              </>
                            ) : (
                              <>
                                <IconoContacto className="w-3 h-3" />
                                <span>DIRECTO A {aviso.destinatario?.nombre ?? "COLABORADOR"}</span>
                              </>
                            )}
                          </span>
                          <span className="text-xs font-mono text-[#726C60]">
                            {formatearFecha(aviso.creadoAt)}
                          </span>
                        </div>

                        {/* Status Stamp de lectura */}
                        <StatusStamp
                          tone={
                            todoLeido
                              ? "fresco"
                              : parcialLeido
                              ? "alerta"
                              : "critico"
                          }
                          size="sm"
                        >
                          {aviso.tipo === "EQUIPO"
                            ? `${leidos}/${total} LEÍDOS`
                            : aviso.leido
                            ? "LEÍDO"
                            : "PENDIENTE"}
                        </StatusStamp>
                      </div>

                      <p className="text-sm font-sans text-[#1E2320] leading-relaxed mb-3 whitespace-pre-wrap">
                        {aviso.mensaje}
                      </p>

                      <div
                        className="pt-2 border-t flex items-center justify-between text-xs text-[#726C60]"
                        style={{ borderColor: TOKENS.line }}
                      >
                        <span className="font-mono text-[11px]">
                          {aviso.tipo === "EQUIPO"
                            ? `Alcance: ${total} colaboradores asignados`
                            : `Destinatario: ${aviso.destinatario?.nombre} ${aviso.destinatario?.apellido || ""}`}
                        </span>

                        {aviso.tipo === "INDIVIDUAL" && aviso.leidoAt && (
                          <span className="font-mono text-[11px] text-[#4F7A52]">
                            Leído el {formatearFecha(aviso.leidoAt)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 3. BANDEJA DE AVISOS RECIBIDOS (IMPULSADOR Y TEAM LEADER) */}
        {(tab === "recibidos" || esImpulsador) && (
          <div className="space-y-4">
            {recibidos.length === 0 ? (
              <div
                className="p-12 text-center rounded-xl border"
                style={{ backgroundColor: TOKENS.canvas, borderColor: TOKENS.line }}
              >
                <p className="text-base font-bold text-[#1E2320] mb-1">
                  Bandeja de avisos al día
                </p>
                <p className="text-xs text-[#726C60]">
                  No tienes comunicados pendientes en este momento.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {recibidos.map((aviso) => {
                  const noLeido = !aviso.leido;

                  return (
                    <div
                      key={aviso.id}
                      className={`p-4 rounded-xl border transition-all ${
                        noLeido
                          ? "bg-white shadow-sm ring-1 ring-[#C1752B]/40"
                          : "opacity-90"
                      }`}
                      style={{
                        backgroundColor: TOKENS.canvas,
                        borderColor: noLeido ? TOKENS.alerta : TOKENS.line,
                      }}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="text-[10px] font-mono uppercase px-2 py-0.5 rounded font-bold inline-flex items-center gap-1"
                            style={{
                              backgroundColor:
                                aviso.tipo === "EQUIPO" ? "var(--accent-soft)" : TOKENS.bone,
                              color:
                                aviso.tipo === "EQUIPO" ? TOKENS.frio : TOKENS.carne,
                            }}
                          >
                            {aviso.tipo === "EQUIPO" ? (
                              <>
                                <IconoMegafono className="w-3 h-3" />
                                <span>COMUNICADO GENERAL</span>
                              </>
                            ) : (
                              <>
                                <IconoContacto className="w-3 h-3" />
                                <span>MENSAJE DIRECTO</span>
                              </>
                            )}
                          </span>
                          <span className="text-xs font-mono text-[#726C60]">
                            {formatearFecha(aviso.creadoAt)}
                          </span>
                        </div>

                        <StatusStamp tone={noLeido ? "alerta" : "fresco"} size="sm">
                          {noLeido ? "NO LEÍDO" : "LEÍDO"}
                        </StatusStamp>
                      </div>

                      <div className="mb-2">
                        <span className="text-xs font-bold text-[#726C60]">
                          De: {aviso.emisor.nombre} {aviso.emisor.apellido || ""}
                        </span>
                      </div>

                      <p className="text-sm font-sans text-[#1E2320] leading-relaxed mb-4 whitespace-pre-wrap font-medium">
                        {aviso.mensaje}
                      </p>

                      <div
                        className="pt-2.5 border-t flex items-center justify-between"
                        style={{ borderColor: TOKENS.line }}
                      >
                        <span className="text-xs font-mono text-[#726C60]">
                          {aviso.leido && aviso.leidoAt
                            ? `Confirmado: ${formatearFecha(aviso.leidoAt)}`
                            : "Pendiente de acuse de recibo"}
                        </span>

                        {noLeido && (
                          <button
                            type="button"
                            onClick={() => handleMarcarLeido(aviso.id)}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider text-white shadow-sm transition-all hover:brightness-110 flex items-center gap-1.5 cursor-pointer"
                            style={{ backgroundColor: TOKENS.fresco }}
                          >
                            <IconoCheck className="w-3.5 h-3.5" />
                            <span>Entendido / Marcar Leído</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
