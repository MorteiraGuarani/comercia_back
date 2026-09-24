"use client";

import React, { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { mensajeError } from "@/utils/error";
import { TOKENS } from "./tokens";
import { StatusStamp } from "./ui/status-stamp";
import { TopBar } from "./ui/top-bar";
import { PantallaCarga } from "@/components/pantalla-carga";
import { IconoMegafono, IconoContacto, IconoCheck } from "./ui/iconos-campo";
import { crearAvisoCampo } from "@/lib/api-adjuntos-campo";
import { SelectorFotosCampo } from "./selector-fotos-campo";
import { GaleriaAdjuntosCampo } from "./galeria-adjuntos-campo";
import { SelectorPaginado } from "@/components/selector-paginado";
import { Paginacion } from "@/components/paginacion";
import { descripcionFrecuenciaAviso } from "@/utils/aviso";
import type { RespuestaPaginada } from "@/types/paginacion";
import type {
  AvisoEnviadoItem,
  AvisoRecibidoItem,
  FormAvisoCampo,
  TipoAviso,
  DestinatarioAviso,
  FrecuenciaAviso,
  ProgramacionAvisoItem,
} from "@/types/campo";

function itemsDeLista<T>(
  res: T[] | RespuestaPaginada<T> | null | undefined,
): T[] {
  if (Array.isArray(res)) return res;
  if (res && Array.isArray(res.items)) return res.items;
  return [];
}

interface AvisosPanelProps {
  esImpulsador?: boolean;
}

export function AvisosPanel({ esImpulsador = false }: AvisosPanelProps) {
  // Tabs: para lider: "recibidos" | "enviados" | "redactar". Para impulsador: "recibidos"
  const [tab, setTab] = useState<
    "recibidos" | "enviados" | "programados" | "redactar"
  >(esImpulsador ? "recibidos" : "enviados");

  const [recibidos, setRecibidos] = useState<AvisoRecibidoItem[]>([]);
  const [enviados, setEnviados] = useState<AvisoEnviadoItem[]>([]);
  const [programados, setProgramados] =
    useState<RespuestaPaginada<ProgramacionAvisoItem> | null>(null);
  const [programadosPage, setProgramadosPage] = useState(1);
  const [programadosLimit, setProgramadosLimit] = useState(7);

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");

  // Estado del formulario
  const [formTipo, setFormTipo] = useState<TipoAviso>("EQUIPO");
  const [formDestinatarioId, setFormDestinatarioId] = useState<number | "">("");
  const [formDestinatarios, setFormDestinatarios] = useState<
    DestinatarioAviso[]
  >([]);
  const [formModo, setFormModo] = useState<"AHORA" | "PROGRAMAR">("AHORA");
  const [formFrecuencia, setFormFrecuencia] =
    useState<FrecuenciaAviso>("UNA_VEZ");
  const [formFechaInicio, setFormFechaInicio] = useState("");
  const [formHora, setFormHora] = useState("");
  const [formIntervaloHoras, setFormIntervaloHoras] = useState(1);
  const [formDiasSemana, setFormDiasSemana] = useState<number[]>([]);
  const [formDiaMes, setFormDiaMes] = useState(1);
  const [formFechaFin, setFormFechaFin] = useState("");
  const [formMensaje, setFormMensaje] = useState("");
  const [formFotos, setFormFotos] = useState<File[]>([]);
  const [enviando, setEnviando] = useState(false);

  // Cargar avisos recibidos
  const cargarRecibidos = async () => {
    try {
      const res = await apiFetch<RespuestaPaginada<AvisoRecibidoItem>>(
        "/campo/avisos/recibidos?page=1&limit=50",
      );
      setRecibidos(itemsDeLista(res));
    } catch (e: unknown) {
      console.error("Error cargando avisos recibidos:", e);
    }
  };

  // Cargar avisos enviados
  const cargarEnviados = async () => {
    try {
      const res = await apiFetch<RespuestaPaginada<AvisoEnviadoItem>>(
        "/campo/avisos/enviados?page=1&limit=50",
      );
      setEnviados(itemsDeLista(res));
    } catch (e: unknown) {
      console.error("Error cargando avisos enviados:", e);
    }
  };

  // Cargar colaboradores para el selector individual
  const cargarProgramados = async (
    page = programadosPage,
    limit = programadosLimit,
  ) => {
    try {
      const res = await apiFetch<RespuestaPaginada<ProgramacionAvisoItem>>(
        `/campo/avisos/programaciones?page=${page}&limit=${limit}`,
      );
      setProgramados(res);
    } catch (e) {
      setError(mensajeError(e, "Error al cargar avisos programados"));
    }
  };

  const inicializar = async () => {
    setCargando(true);
    setError("");
    try {
      await Promise.all([
        cargarRecibidos(),
        !esImpulsador ? cargarEnviados() : null,
        !esImpulsador ? cargarProgramados() : null,
      ]);
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
    if (formTipo === "SELECCION" && formDestinatarios.length === 0) {
      setError("Selecciona uno o varios colaboradores.");
      return;
    }
    if (
      formModo === "PROGRAMAR" &&
      (!formFechaInicio ||
        !formHora ||
        (formFrecuencia === "SEMANAL" && !formDiasSemana.length))
    ) {
      setError("Indica fecha, hora y los días de envío cuando corresponda.");
      return;
    }

    setEnviando(true);
    setError("");
    setExito("");

    try {
      const payload: FormAvisoCampo = {
        tipo: formTipo,
        mensaje: formMensaje.trim(),
        destinatariosIds:
          formTipo === "SELECCION"
            ? formDestinatarios.map((item) => item.id)
            : undefined,
        frecuencia: formModo === "PROGRAMAR" ? formFrecuencia : undefined,
        fechaInicio: formModo === "PROGRAMAR" ? formFechaInicio : undefined,
        hora: formModo === "PROGRAMAR" ? formHora : undefined,
        intervaloHoras:
          formModo === "PROGRAMAR" && formFrecuencia === "HORARIA"
            ? formIntervaloHoras
            : undefined,
        diasSemana:
          formModo === "PROGRAMAR" && formFrecuencia === "SEMANAL"
            ? formDiasSemana
            : undefined,
        diaMes:
          formModo === "PROGRAMAR" && formFrecuencia === "MENSUAL"
            ? formDiaMes
            : undefined,
        fechaFin:
          formModo === "PROGRAMAR" &&
          formFrecuencia !== "UNA_VEZ" &&
          formFechaFin
            ? formFechaFin
            : undefined,
      };

      await crearAvisoCampo(payload, formFotos);

      setFormMensaje("");
      setFormFotos([]);
      setFormDestinatarios([]);
      setExito(
        formModo === "PROGRAMAR"
          ? "Aviso programado correctamente."
          : "Aviso enviado correctamente.",
      );
      await cargarEnviados();
      await cargarProgramados(1, programadosLimit);
      setProgramadosPage(1);
      setTab(formModo === "PROGRAMAR" ? "programados" : "enviados");
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
        prev.map((a) =>
          a.id === id
            ? { ...a, leido: true, leidoAt: new Date().toISOString() }
            : a,
        ),
      );
    } catch (err: unknown) {
      console.error("Error al marcar aviso como leído:", err);
    }
  };

  const cancelarProgramacion = async (id: number) => {
    setEnviando(true);
    setError("");
    try {
      await apiFetch(`/campo/avisos/programaciones/${id}`, {
        method: "DELETE",
      });
      await cargarProgramados();
      setExito("Programación cancelada.");
    } catch (e) {
      setError(mensajeError(e, "No se pudo cancelar la programación"));
    } finally {
      setEnviando(false);
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
    return (
      <PantallaCarga
        visible={cargando}
        mensaje="Sincronizando canal de avisos y novedades..."
      />
    );
  }

  return (
    <div
      className="campo-screen min-h-screen min-w-0 w-full text-[14px] font-sans"
      style={{ backgroundColor: TOKENS.bone, color: TOKENS.ink }}
    >
      <TopBar
        title="Avisos"
        subtitle={
          esImpulsador
            ? "Mensajes e instrucciones operativas de tu supervisor"
            : "Avisos al equipo: envío y seguimiento de comunicados"
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

      <PantallaCarga
        visible={enviando}
        mensaje={
          formModo === "PROGRAMAR"
            ? "Guardando aviso programado y fotos"
            : formFotos.length
              ? "Enviando comunicado y subiendo fotos"
              : "Enviando comunicado"
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
            <span className="min-w-0 break-words">{error}</span>
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
            <span className="min-w-0 break-words">{exito}</span>
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
          <div
            className="min-w-0 border-b pb-4"
            style={{ borderColor: TOKENS.line }}
          >
            <div className="grid w-full min-w-0 grid-cols-[repeat(3,minmax(0,1fr))_2.75rem] items-center gap-1.5 sm:flex sm:gap-2">
              <button
                type="button"
                onClick={() => setTab("enviados")}
                className={`min-w-0 px-2 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-brand-600 sm:px-5 sm:text-sm ${
                  tab === "enviados"
                    ? "bg-brand-700 text-white shadow-sm dark:bg-brand-200 dark:text-brand-950"
                    : "border border-line bg-surface-raised text-foreground hover:bg-surface-soft"
                }`}
                style={{
                  borderColor: tab === "enviados" ? "transparent" : TOKENS.line,
                }}
              >
                Enviados{" "}
                <span className="hidden sm:inline">({enviados.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setTab("recibidos")}
                className={`min-w-0 justify-center px-2 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer focus-visible:ring-2 focus-visible:ring-brand-600 sm:px-5 sm:text-sm ${
                  tab === "recibidos"
                    ? "bg-brand-700 text-white shadow-sm dark:bg-brand-200 dark:text-brand-950"
                    : "border border-line bg-surface-raised text-foreground hover:bg-surface-soft"
                }`}
                style={{
                  borderColor:
                    tab === "recibidos" ? "transparent" : TOKENS.line,
                }}
              >
                <span>Recibidos</span>
                {noLeidosCount > 0 && (
                  <span
                    className="text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold text-white"
                    style={{ backgroundColor: TOKENS.carne }}
                  >
                    {noLeidosCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setTab("programados")}
                className={`min-w-0 rounded-xl px-1 py-2.5 text-[10px] font-bold uppercase tracking-wide transition-all focus-visible:ring-2 focus-visible:ring-brand-600 sm:px-5 sm:text-sm ${
                  tab === "programados"
                    ? "bg-brand-700 text-white dark:bg-brand-200 dark:text-brand-950"
                    : "border border-line bg-surface-raised text-foreground hover:bg-surface-soft"
                }`}
              >
                Programados
              </button>
              <button
                type="button"
                onClick={() => setTab("redactar")}
                aria-label="Crear aviso"
                title="Crear aviso"
                className={`grid h-11 w-11 place-items-center rounded-xl text-sm font-bold transition-all focus-visible:ring-2 focus-visible:ring-brand-600 sm:ml-auto ${
                  tab === "redactar"
                    ? "bg-brand-700 text-white dark:bg-brand-200 dark:text-brand-950"
                    : "border border-line bg-surface-raised text-foreground hover:bg-surface-soft"
                }`}
              >
                <span aria-hidden="true" className="text-xl">
                  +
                </span>
              </button>
            </div>
          </div>
        ) : (
          <div
            className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b pb-3"
            style={{ borderColor: TOKENS.line }}
          >
            <h2 className="text-xl font-bold uppercase tracking-wide ft-display">
              Mensajes y Avisos Recibidos
            </h2>
            <span className="text-xs font-mono text-muted">
              Total: {recibidos.length} | Pendientes: {noLeidosCount}
            </span>
          </div>
        )}

        {/* CONTENIDO SEGÚN PESTAÑA */}

        {/* 1. FORMULARIO DE NUEVO COMUNICADO */}
        {tab === "redactar" && !esImpulsador && (
          <div className="min-w-0 max-w-full rounded-xl border border-line bg-surface-raised p-3 text-foreground shadow-sm sm:p-6">
            <div
              className="mb-5 border-b pb-3"
              style={{ borderColor: TOKENS.line }}
            >
              <h3 className="text-xl font-bold uppercase tracking-wide ft-display">
                Transmitir Comunicado a Campo
              </h3>
              <p className="text-xs text-muted">
                Envía ahora o programa un aviso para todo tu equipo o para los
                colaboradores que elijas.
              </p>
            </div>

            <form onSubmit={handleEnviar} className="min-w-0 space-y-5">
              {/* Tipo de alcance */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-muted">
                  Alcance del Mensaje
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormTipo("EQUIPO")}
                    aria-pressed={formTipo === "EQUIPO"}
                    className={`flex w-full min-w-0 items-start gap-3 rounded-lg border p-3 text-left whitespace-normal transition-all sm:p-3.5 ${
                      formTipo === "EQUIPO"
                        ? "border-brand-700 bg-brand-50 text-foreground shadow-sm ring-1 ring-brand-700 dark:border-brand-200 dark:bg-brand-950"
                        : "border-line bg-surface-soft text-foreground hover:bg-surface-raised"
                    }`}
                  >
                    <div
                      className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border"
                      style={{
                        borderColor:
                          formTipo === "EQUIPO" ? TOKENS.ink : TOKENS.sub,
                      }}
                    >
                      {formTipo === "EQUIPO" && (
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: TOKENS.ink }}
                        />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="break-words text-sm font-bold">
                        Todo el Equipo de Campo
                      </div>
                      <div className="break-words text-xs text-muted">
                        Se transmite a todos los colaboradores activos de tu
                        equipo.
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormTipo("SELECCION")}
                    aria-pressed={formTipo === "SELECCION"}
                    className={`flex w-full min-w-0 items-start gap-3 rounded-lg border p-3 text-left whitespace-normal transition-all sm:p-3.5 ${
                      formTipo === "SELECCION"
                        ? "border-brand-700 bg-brand-50 text-foreground shadow-sm ring-1 ring-brand-700 dark:border-brand-200 dark:bg-brand-950"
                        : "border-line bg-surface-soft text-foreground hover:bg-surface-raised"
                    }`}
                  >
                    <div
                      className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border"
                      style={{
                        borderColor:
                          formTipo === "SELECCION" ? TOKENS.ink : TOKENS.sub,
                      }}
                    >
                      {formTipo === "SELECCION" && (
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: TOKENS.ink }}
                        />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="break-words text-sm font-bold">
                        Uno o varios colaboradores
                      </div>
                      <div className="break-words text-xs text-muted">
                        Elige exactamente quiénes recibirán el aviso.
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Selector de colaborador (si es individual) */}
              {formTipo === "SELECCION" && (
                <div>
                  <SelectorPaginado
                    url="/campo/avisos/destinatarios"
                    etiqueta="Agregar colaborador"
                    value={formDestinatarioId}
                    onChange={setFormDestinatarioId}
                    onSeleccionar={(opcion) => {
                      setFormDestinatarios((prev) =>
                        prev.some((item) => item.id === opcion.id)
                          ? prev
                          : [
                              ...prev,
                              {
                                id: opcion.id,
                                nombre:
                                  opcion.nombre ?? `Colaborador ${opcion.id}`,
                              },
                            ],
                      );
                      setFormDestinatarioId("");
                    }}
                    buscable
                  />
                  <div
                    className="mt-2 flex min-w-0 flex-wrap gap-2"
                    aria-label="Destinatarios elegidos"
                  >
                    {formDestinatarios.map((item) => (
                      <span
                        key={item.id}
                        className="inline-flex max-w-full items-center gap-1 rounded-lg border border-line bg-surface-soft px-2 py-1 text-sm text-foreground"
                      >
                        <span className="truncate">{item.nombre}</span>
                        <button
                          type="button"
                          aria-label={`Quitar a ${item.nombre}`}
                          onClick={() =>
                            setFormDestinatarios((prev) =>
                              prev.filter((actual) => actual.id !== item.id),
                            )
                          }
                          className="grid h-9 w-9 shrink-0 place-items-center rounded hover:bg-surface-raised focus-visible:ring-2 focus-visible:ring-brand-600"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Mensaje */}
              <div>
                <div className="mb-1.5 flex min-w-0 flex-wrap items-center justify-between gap-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted">
                    Texto del Comunicado
                  </label>
                  <span className="text-[11px] font-mono text-muted">
                    {formMensaje.length} caracteres
                  </span>
                </div>
                <textarea
                  rows={4}
                  value={formMensaje}
                  onChange={(e) => setFormMensaje(e.target.value)}
                  placeholder="Ej: Recordatorio urgente: priorizar reposición de la línea fresca en Superseis Los Laureles antes de las 14:00..."
                  className="w-full min-w-0 rounded-lg border border-line bg-surface-raised p-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand-600"
                  style={{ borderColor: TOKENS.line }}
                  required
                />
              </div>

              <fieldset className="min-w-0 space-y-3 rounded-xl border border-line bg-surface-soft p-3 sm:p-4">
                <legend className="px-1 text-xs font-bold uppercase tracking-wider text-muted">
                  Momento del envío
                </legend>
                <div className="grid grid-cols-2 gap-2">
                  {(["AHORA", "PROGRAMAR"] as const).map((modo) => (
                    <button
                      key={modo}
                      type="button"
                      onClick={() => setFormModo(modo)}
                      aria-pressed={formModo === modo}
                      className={`min-h-11 rounded-lg border px-2 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-brand-600 ${formModo === modo ? "border-brand-700 bg-brand-700 text-white dark:border-brand-200 dark:bg-brand-200 dark:text-brand-950" : "border-line bg-surface-raised text-foreground hover:bg-surface-soft"}`}
                    >
                      {modo === "AHORA" ? "Enviar ahora" : "Programar"}
                    </button>
                  ))}
                </div>
                {formModo === "PROGRAMAR" && (
                  <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="text-xs font-semibold text-muted">
                      Repetición
                      <select
                        value={formFrecuencia}
                        onChange={(e) =>
                          setFormFrecuencia(e.target.value as FrecuenciaAviso)
                        }
                        className="mt-1 min-h-11 w-full rounded-lg border border-line bg-surface-raised px-3 text-sm text-foreground"
                      >
                        <option value="UNA_VEZ">Una vez</option>
                        <option value="HORARIA">Cada ciertas horas</option>
                        <option value="DIARIA">Cada día</option>
                        <option value="SEMANAL">Cada semana</option>
                        <option value="MENSUAL">Cada mes</option>
                      </select>
                    </label>
                    <label className="text-xs font-semibold text-muted">
                      Primera fecha
                      <input
                        type="date"
                        value={formFechaInicio}
                        onChange={(e) => setFormFechaInicio(e.target.value)}
                        required
                        className="mt-1 min-h-11 w-full min-w-0 rounded-lg border border-line bg-surface-raised px-3 text-sm text-foreground"
                      />
                    </label>
                    <label className="text-xs font-semibold text-muted">
                      Hora (Paraguay)
                      <input
                        type="time"
                        value={formHora}
                        onChange={(e) => setFormHora(e.target.value)}
                        required
                        className="mt-1 min-h-11 w-full min-w-0 rounded-lg border border-line bg-surface-raised px-3 text-sm text-foreground"
                      />
                    </label>
                    {formFrecuencia === "MENSUAL" && (
                      <label className="text-xs font-semibold text-muted">
                        Día del mes
                        <input
                          type="number"
                          min={1}
                          max={31}
                          value={formDiaMes}
                          onChange={(e) =>
                            setFormDiaMes(Number(e.target.value))
                          }
                          className="mt-1 min-h-11 w-full rounded-lg border border-line bg-surface-raised px-3 text-sm text-foreground"
                        />
                      </label>
                    )}
                    {formFrecuencia === "HORARIA" && (
                      <label className="text-xs font-semibold text-muted">
                        Repetir cada (horas)
                        <input
                          type="number"
                          min={1}
                          max={168}
                          value={formIntervaloHoras}
                          onChange={(e) =>
                            setFormIntervaloHoras(Number(e.target.value))
                          }
                          className="mt-1 min-h-11 w-full rounded-lg border border-line bg-surface-raised px-3 text-sm text-foreground"
                        />
                      </label>
                    )}
                    {formFrecuencia !== "UNA_VEZ" && (
                      <label className="text-xs font-semibold text-muted">
                        Finalizar después de (opcional)
                        <input
                          type="date"
                          value={formFechaFin}
                          min={formFechaInicio}
                          onChange={(e) => setFormFechaFin(e.target.value)}
                          className="mt-1 min-h-11 w-full min-w-0 rounded-lg border border-line bg-surface-raised px-3 text-sm text-foreground"
                        />
                      </label>
                    )}
                    {formFrecuencia === "SEMANAL" && (
                      <div className="sm:col-span-2">
                        <p className="mb-1 text-xs font-semibold text-muted">
                          Días de la semana
                        </p>
                        <div className="grid grid-cols-7 gap-1">
                          {(["L", "M", "X", "J", "V", "S", "D"] as const).map(
                            (dia, index) => (
                              <button
                                key={index}
                                type="button"
                                aria-label={
                                  [
                                    "Lunes",
                                    "Martes",
                                    "Miércoles",
                                    "Jueves",
                                    "Viernes",
                                    "Sábado",
                                    "Domingo",
                                  ][index]
                                }
                                aria-pressed={formDiasSemana.includes(
                                  index + 1,
                                )}
                                onClick={() =>
                                  setFormDiasSemana((prev) =>
                                    prev.includes(index + 1)
                                      ? prev.filter((n) => n !== index + 1)
                                      : [...prev, index + 1].sort(),
                                  )
                                }
                                className={`min-h-11 min-w-0 rounded-lg border text-sm font-bold focus-visible:ring-2 focus-visible:ring-brand-600 ${formDiasSemana.includes(index + 1) ? "border-brand-700 bg-brand-700 text-white dark:border-brand-200 dark:bg-brand-200 dark:text-brand-950" : "border-line bg-surface-raised text-foreground hover:bg-surface-soft"}`}
                              >
                                {dia}
                              </button>
                            ),
                          )}
                        </div>
                      </div>
                    )}
                    <p className="text-xs text-muted sm:col-span-2">
                      Las repeticiones continúan hasta que las canceles o llegue
                      la fecha de fin. En meses cortos, el día 29, 30 o 31 se
                      ajusta al último día.
                    </p>
                  </div>
                )}
              </fieldset>

              <SelectorFotosCampo
                archivos={formFotos}
                onChange={setFormFotos}
                disabled={enviando}
              />

              {/* Botón de envío */}
              <div className="grid min-w-0 grid-cols-2 gap-2 pt-2 sm:flex sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setTab("enviados");
                    setFormFotos([]);
                  }}
                  className="min-h-11 min-w-0 rounded-lg border border-line bg-surface-raised px-3 text-sm font-semibold text-foreground transition hover:bg-surface-soft focus-visible:ring-2 focus-visible:ring-brand-600 sm:px-5"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={enviando || !formMensaje.trim()}
                  className="min-h-11 min-w-0 rounded-lg bg-brand-700 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800 focus-visible:ring-2 focus-visible:ring-brand-600 disabled:cursor-not-allowed disabled:border disabled:border-line disabled:bg-surface-soft disabled:text-foreground disabled:opacity-100 dark:bg-brand-200 dark:text-brand-950 dark:hover:bg-brand-100 dark:disabled:bg-surface-soft dark:disabled:text-foreground sm:px-6"
                >
                  {enviando
                    ? "Guardando…"
                    : formModo === "PROGRAMAR"
                      ? "Programar"
                      : "Enviar"}
                </button>
              </div>
            </form>
          </div>
        )}

        {tab === "programados" && !esImpulsador && (
          <section
            data-inicio-listado
            className="min-w-0 space-y-3 scroll-mt-20"
            aria-label="Avisos programados"
          >
            <h2 className="text-lg font-bold text-foreground">
              Avisos programados
            </h2>
            {!programados?.items.length ? (
              <p className="rounded-xl border border-line bg-surface-raised p-5 text-sm text-muted">
                Aún no hay avisos programados.
              </p>
            ) : (
              <>
                <div className="space-y-2 md:hidden">
                  {programados.items.map((item) => (
                    <article
                      key={item.id}
                      className="min-w-0 rounded-xl border border-line bg-surface-raised p-3 text-foreground"
                    >
                      <p className="break-words text-sm font-semibold">
                        {item.mensaje}
                      </p>
                      <p className="mt-2 text-xs text-muted">
                        {descripcionFrecuenciaAviso(item)} · {item.hora} ·{" "}
                        {item.activo
                          ? `Próximo: ${formatearFecha(item.proximoEnvioAt)}`
                          : "Finalizado"}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {item.tipo === "EQUIPO"
                          ? "Todo el equipo"
                          : `${item.destinatariosIds.length} destinatarios`}
                      </p>
                      {item.activo && (
                        <button
                          type="button"
                          onClick={() => void cancelarProgramacion(item.id)}
                          className="mt-2 min-h-11 w-full rounded-lg border border-line bg-surface-soft px-3 text-sm font-semibold text-foreground hover:bg-surface-raised focus-visible:ring-2 focus-visible:ring-brand-600"
                        >
                          Cancelar programación
                        </button>
                      )}
                    </article>
                  ))}
                </div>
                <div className="hidden overflow-x-auto rounded-xl border border-line bg-surface-raised md:block">
                  <table className="w-full min-w-[620px] text-left text-sm text-foreground">
                    <thead className="border-b border-line bg-surface-soft text-xs uppercase text-muted">
                      <tr>
                        <th className="p-3">Aviso</th>
                        <th className="p-3">Repetición</th>
                        <th className="p-3">Próximo envío</th>
                        <th className="p-3">Estado</th>
                        <th className="p-3">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {programados.items.map((item) => (
                        <tr
                          key={item.id}
                          className="border-b border-line last:border-0"
                        >
                          <td className="max-w-[300px] p-3">
                            <p className="break-words font-semibold">
                              {item.mensaje}
                            </p>
                            <p className="text-xs text-muted">
                              {item.tipo === "EQUIPO"
                                ? "Todo el equipo"
                                : `${item.destinatariosIds.length} destinatarios`}
                            </p>
                          </td>
                          <td className="p-3">
                            {descripcionFrecuenciaAviso(item)} · {item.hora}
                          </td>
                          <td className="p-3">
                            {item.activo
                              ? formatearFecha(item.proximoEnvioAt)
                              : "—"}
                          </td>
                          <td className="p-3">
                            {item.activo ? "Activo" : "Finalizado"}
                          </td>
                          <td className="p-3">
                            {item.activo && (
                              <button
                                type="button"
                                onClick={() =>
                                  void cancelarProgramacion(item.id)
                                }
                                className="min-h-11 rounded-lg border border-line bg-surface-soft px-3 text-sm font-semibold hover:bg-surface-raised focus-visible:ring-2 focus-visible:ring-brand-600"
                              >
                                Cancelar
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            {programados && (
              <Paginacion
                page={programadosPage}
                limit={programadosLimit}
                total={programados.total}
                totalPages={programados.totalPages}
                onPageChange={(page) => {
                  setProgramadosPage(page);
                  void cargarProgramados(page, programadosLimit);
                }}
                onLimitChange={(limit) => {
                  setProgramadosLimit(limit);
                  setProgramadosPage(1);
                  void cargarProgramados(1, limit);
                }}
              />
            )}
          </section>
        )}

        {/* 2. BANDEJA DE AVISOS ENVIADOS (TEAM LEADER) */}
        {tab === "enviados" && !esImpulsador && (
          <div className="space-y-4">
            {enviados.length === 0 ? (
              <div
                className="rounded-xl border p-5 text-center sm:p-12"
                style={{
                  backgroundColor: TOKENS.canvas,
                  borderColor: TOKENS.line,
                }}
              >
                <p className="text-base font-bold text-foreground mb-1">
                  No hay avisos enviados aún
                </p>
                <p className="text-xs text-muted mb-4">
                  Envía el primer comunicado a tu equipo de impulsadores de
                  campo.
                </p>
                <button
                  type="button"
                  onClick={() => setTab("redactar")}
                  aria-label="Crear comunicado"
                  title="Crear comunicado"
                  className="inline-grid h-11 w-11 place-items-center rounded-lg text-white"
                  style={{ backgroundColor: TOKENS.ink }}
                >
                  <span aria-hidden="true" className="text-xl">
                    +
                  </span>
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
                      className="min-w-0 rounded-xl border p-3 transition-all hover:shadow-sm sm:p-4"
                      style={{
                        backgroundColor: TOKENS.canvas,
                        borderColor: TOKENS.line,
                      }}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <span
                            className="inline-flex max-w-full min-w-0 items-center gap-1 rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase"
                            style={{
                              backgroundColor:
                                aviso.tipo === "EQUIPO"
                                  ? "var(--accent-soft)"
                                  : TOKENS.bone,
                              color:
                                aviso.tipo === "EQUIPO"
                                  ? TOKENS.frio
                                  : TOKENS.carne,
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
                                <span className="min-w-0 truncate">
                                  {aviso.tipo === "SELECCION"
                                    ? `${aviso.total ?? 0} DESTINATARIOS`
                                    : `DIRECTO A ${aviso.destinatario?.nombre ?? "COLABORADOR"}`}
                                </span>
                              </>
                            )}
                          </span>
                          <span className="text-xs font-mono text-muted">
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
                          {aviso.tipo !== "INDIVIDUAL"
                            ? `${leidos}/${total} LEÍDOS`
                            : aviso.leido
                              ? "LEÍDO"
                              : "PENDIENTE"}
                        </StatusStamp>
                      </div>

                      <p className="mb-3 break-words whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                        {aviso.mensaje}
                      </p>

                      <GaleriaAdjuntosCampo adjuntos={aviso.adjuntos} />

                      <div
                        className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-t pt-2 text-xs text-muted"
                        style={{ borderColor: TOKENS.line }}
                      >
                        <span className="min-w-0 break-words font-mono text-[11px]">
                          {aviso.tipo === "EQUIPO"
                            ? `Alcance: ${total} colaboradores asignados`
                            : aviso.tipo === "SELECCION"
                              ? `Destinatarios: ${aviso.destinatarios?.map((persona) => `${persona.nombre} ${persona.apellido}`).join(", ") || `${total} colaboradores`}`
                              : `Destinatario: ${aviso.destinatario?.nombre} ${aviso.destinatario?.apellido || ""}`}
                        </span>

                        {aviso.tipo === "INDIVIDUAL" && aviso.leidoAt && (
                          <span className="min-w-0 break-words font-mono text-[11px] text-accent-ink">
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
                className="rounded-xl border p-5 text-center sm:p-12"
                style={{
                  backgroundColor: TOKENS.canvas,
                  borderColor: TOKENS.line,
                }}
              >
                <p className="text-base font-bold text-foreground mb-1">
                  Bandeja de avisos al día
                </p>
                <p className="text-xs text-muted">
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
                      className={`min-w-0 rounded-xl border p-3 transition-all sm:p-4 ${
                        noLeido
                          ? "bg-surface-raised shadow-sm ring-1 ring-[#C1752B]/40"
                          : "opacity-90"
                      }`}
                      style={{
                        backgroundColor: TOKENS.canvas,
                        borderColor: noLeido ? TOKENS.alerta : TOKENS.line,
                      }}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <span
                            className="inline-flex max-w-full min-w-0 items-center gap-1 rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase"
                            style={{
                              backgroundColor:
                                aviso.tipo === "EQUIPO"
                                  ? "var(--accent-soft)"
                                  : TOKENS.bone,
                              color:
                                aviso.tipo === "EQUIPO"
                                  ? TOKENS.frio
                                  : TOKENS.carne,
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
                          <span className="text-xs font-mono text-muted">
                            {formatearFecha(aviso.creadoAt)}
                          </span>
                        </div>

                        <StatusStamp
                          tone={noLeido ? "alerta" : "fresco"}
                          size="sm"
                        >
                          {noLeido ? "NO LEÍDO" : "LEÍDO"}
                        </StatusStamp>
                      </div>

                      <div className="mb-2">
                        <span className="text-xs font-bold text-muted">
                          De: {aviso.emisor.nombre}{" "}
                          {aviso.emisor.apellido || ""}
                        </span>
                      </div>

                      <p className="mb-4 break-words whitespace-pre-wrap text-sm font-medium leading-relaxed text-foreground">
                        {aviso.mensaje}
                      </p>

                      <GaleriaAdjuntosCampo adjuntos={aviso.adjuntos} />

                      <div
                        className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-t pt-2.5"
                        style={{ borderColor: TOKENS.line }}
                      >
                        <span className="min-w-0 break-words font-mono text-xs text-muted">
                          {aviso.leido && aviso.leidoAt
                            ? `Confirmado: ${formatearFecha(aviso.leidoAt)}`
                            : "Pendiente de acuse de recibo"}
                        </span>

                        {noLeido && (
                          <button
                            type="button"
                            onClick={() => handleMarcarLeido(aviso.id)}
                            className="flex min-h-11 items-center gap-1.5 rounded-lg bg-brand-700 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-800 focus-visible:ring-2 focus-visible:ring-brand-600 dark:bg-brand-200 dark:text-brand-950 dark:hover:bg-brand-100"
                          >
                            <IconoCheck className="w-3.5 h-3.5" />
                            <span>Marcar leído</span>
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
