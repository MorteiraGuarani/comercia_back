"use client";

import React, { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { TOKENS } from "./tokens";
import { StatusStamp } from "./ui/status-stamp";
import { TopBar } from "./ui/top-bar";
import { Modal } from "@/components/modal";
import { PantallaCarga } from "@/components/pantalla-carga";
import type {
  NovedadCampoItem,
  NovedadesResponse,
  TipoNovedad,
  EstadoNovedad,
  LocalCampo,
} from "@/types/campo";

export function NovedadesPanel({
  esImpulsador = false,
}: {
  esImpulsador?: boolean;
}) {
  const [novedades, setNovedades] = useState<NovedadCampoItem[]>([]);
  const [counts, setCounts] = useState({
    abierta: 0,
    cerrada: 0,
    cancelada: 0,
    total: 0,
  });
  const [filtro, setFiltro] = useState<EstadoNovedad>("ABIERTA");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  // Modal para crear novedad
  const [creando, setCreando] = useState(false);
  const [locales, setLocales] = useState<LocalCampo[]>([]);
  const [localSeleccionado, setLocalSeleccionado] = useState<number | null>(
    null,
  );
  const [tipo, setTipo] = useState<TipoNovedad>("INCIDENCIA");
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [guardando, setGuardando] = useState(false);

  // Modal para resolver novedad (Team Leader)
  const [resolviendo, setResolviendo] = useState<NovedadCampoItem | null>(null);
  const [accion, setAccion] = useState<"CERRADA" | "CANCELADA">("CERRADA");
  const [resolucion, setResolucion] = useState("");

  const cargar = async () => {
    try {
      setCargando(true);
      setError("");
      const res = await apiFetch<NovedadesResponse>(
        `/campo/novedades?estado=${filtro}`,
      );
      setNovedades(res.items);
      setCounts(res.counts);
    } catch (e: any) {
      setError(e.message ?? "Error al cargar novedades");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
  }, [filtro]);

  // Cargar locales para el selector si va a crear
  useEffect(() => {
    if (creando && locales.length === 0) {
      apiFetch<{ items: LocalCampo[] }>("/campo/locales?limit=50")
        .then((res) => {
          setLocales(res.items);
          if (res.items.length > 0) setLocalSeleccionado(res.items[0].id);
        })
        .catch(() => {});
    }
  }, [creando, locales.length]);

  const guardarNueva = async () => {
    if (
      !localSeleccionado ||
      !titulo.trim() ||
      !descripcion.trim() ||
      guardando
    )
      return;
    try {
      setGuardando(true);
      await apiFetch("/campo/novedades", {
        method: "POST",
        body: JSON.stringify({
          localId: localSeleccionado,
          tipo,
          titulo: titulo.trim(),
          descripcion: descripcion.trim(),
        }),
      });
      setCreando(false);
      setTitulo("");
      setDescripcion("");
      cargar();
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setGuardando(false);
    }
  };

  const confirmarResolucion = async () => {
    if (!resolviendo || guardando) return;
    try {
      setGuardando(true);
      await apiFetch(`/campo/novedades/${resolviendo.id}/estado`, {
        method: "PUT",
        body: JSON.stringify({
          estado: accion,
          resolucion: resolucion.trim(),
        }),
      });
      setResolviendo(null);
      setResolucion("");
      cargar();
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div
      className="w-full min-h-[calc(100vh-5rem)] flex flex-col font-sans"
      style={{
        background: TOKENS.bone,
        color: TOKENS.ink,
      }}
    >
      <TopBar
        title={esImpulsador ? "Mis Novedades" : "Novedades del Equipo"}
        subtitle={
          esImpulsador
            ? "Reportes e incidencias operativas enviadas a tu supervisor"
            : "Gestión y resolución de novedades reportadas por impulsadores"
        }
        right={
          esImpulsador && (
            <button
              type="button"
              onClick={() => setCreando(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-white shadow-sm transition cursor-pointer"
              style={{ background: TOKENS.carne }}
            >
              + Nueva Novedad
            </button>
          )
        }
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5 flex-1 overflow-y-auto w-full">
        {/* Pestañas de estado (Abiertas, Cerradas, Canceladas) */}
        <div className="flex gap-2.5 shrink-0">
          {(["ABIERTA", "CERRADA", "CANCELADA"] as const).map((st) => {
            const isActive = filtro === st;
            const colors = {
              ABIERTA: TOKENS.alerta,
              CERRADA: TOKENS.fresco,
              CANCELADA: TOKENS.sub,
            };
            const labels = {
              ABIERTA: "Abiertas",
              CERRADA: "Cerradas",
              CANCELADA: "Canceladas",
            };
            const count =
              st === "ABIERTA"
                ? counts.abierta
                : st === "CERRADA"
                  ? counts.cerrada
                  : counts.cancelada;

            return (
              <button
                key={st}
                type="button"
                onClick={() => setFiltro(st)}
                className="flex-1 ft-body text-xs sm:text-sm font-bold py-2 px-3.5 rounded-xl transition-all cursor-pointer select-none"
                style={{
                  background: isActive ? colors[st] : "transparent",
                  color: isActive ? "#ffffff" : TOKENS.sub,
                  border: `1.5px solid ${isActive ? colors[st] : TOKENS.line}`,
                }}
              >
                {labels[st]} ({count})
              </button>
            );
          })}
        </div>

        {cargando ? (
          <div className="py-16 text-center text-sm sm:text-base text-zinc-500 font-mono">
            Cargando novedades...
          </div>
        ) : error ? (
          <div className="p-5 rounded-2xl bg-red-50 text-red-700 text-sm sm:text-base font-semibold">
            {error}
          </div>
        ) : novedades.length === 0 ? (
          <div
            className="rounded-2xl p-12 text-center bg-white"
            style={{ border: `1px solid ${TOKENS.line}` }}
          >
            <p
              className="ft-display text-2xl font-bold mb-1"
              style={{ color: TOKENS.ink }}
            >
              Sin novedades {filtro.toLowerCase()}s
            </p>
            <p className="ft-body text-sm sm:text-base text-zinc-500">
              {filtro === "ABIERTA"
                ? "No hay incidencias ni requerimientos pendientes de atención."
                : "No se registran elementos en este estado."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {novedades.map((n) => {
              const tipoColor =
                {
                  RECLAMO: TOKENS.critico,
                  CONSULTA: TOKENS.frio,
                  SUGERENCIA: TOKENS.fresco,
                  INCIDENCIA: TOKENS.alerta,
                }[n.tipo] ?? TOKENS.alerta;

              return (
                <div
                  key={n.id}
                  className="rounded-xl p-4 sm:p-5 flex flex-col justify-between bg-white shadow-xs hover:shadow-md transition-all"
                  style={{ border: `1px solid ${TOKENS.line}` }}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <span
                        className="ft-body text-[11px] font-extrabold px-2.5 py-0.5 rounded-full uppercase"
                        style={{
                          color: tipoColor,
                          border: `1px solid ${tipoColor}`,
                        }}
                      >
                        {n.tipo}
                      </span>
                      <StatusStamp
                        size="sm"
                        tone={
                          n.estado === "ABIERTA"
                            ? "alerta"
                            : n.estado === "CERRADA"
                              ? "fresco"
                              : "ink"
                        }
                      >
                        {n.estado}
                      </StatusStamp>
                    </div>

                    <p className="ft-body text-sm sm:text-base font-bold mb-1.5 text-zinc-900 leading-snug">
                      {n.titulo}
                    </p>
                    <p className="ft-body text-xs sm:text-sm leading-relaxed text-zinc-700">
                      {n.descripcion}
                    </p>

                    {n.resolucion && (
                      <div
                        className="mt-3 p-3 rounded-xl bg-zinc-50 border text-sm"
                        style={{ borderColor: TOKENS.line }}
                      >
                        <p className="font-bold text-xs sm:text-sm text-zinc-800">
                          Resolución:
                        </p>
                        <p className="text-zinc-700 italic text-xs sm:text-sm mt-0.5">
                          {n.resolucion}
                        </p>
                      </div>
                    )}
                  </div>

                  <div
                    className="mt-3 pt-2.5 flex items-center justify-between text-[11px]"
                    style={{
                      borderTop: `1px solid ${TOKENS.line}`,
                      color: TOKENS.sub,
                    }}
                  >
                    <span>
                      {n.usuario.nombre} {n.usuario.apellido} · {n.local.nombre}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="ft-mono text-[10px]">
                        {new Date(n.creadoAt).toLocaleDateString("es-AR", {
                          hour: "2-digit",
                          minute: "2-digit",
                          day: "2-digit",
                          month: "short",
                        })}
                      </span>
                      {!esImpulsador && n.estado === "ABIERTA" && (
                        <button
                          type="button"
                          onClick={() => {
                            setResolviendo(n);
                            setAccion("CERRADA");
                            setResolucion("");
                          }}
                          className="px-2.5 py-0.5 rounded bg-zinc-800 text-white font-medium text-[10px] hover:bg-black transition cursor-pointer"
                        >
                          Resolver
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Crear Novedad */}
      {creando && (
        <Modal
          titulo="Reportar Nueva Novedad"
          abierto={creando}
          onCerrar={() => setCreando(false)}
          ancho="md"
        >
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">
                Local:
              </label>
              <select
                value={localSeleccionado ?? ""}
                onChange={(e) => setLocalSeleccionado(Number(e.target.value))}
                className="w-full text-xs p-2.5 rounded-lg border border-zinc-300 bg-white outline-none"
              >
                {locales.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nombre} ({l.cliente?.nombre})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">
                Tipo:
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {(
                  ["INCIDENCIA", "RECLAMO", "CONSULTA", "SUGERENCIA"] as const
                ).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTipo(t)}
                    className={`py-1.5 px-2 rounded-md text-xs font-semibold border transition cursor-pointer ${
                      tipo === t
                        ? "bg-zinc-900 text-white border-zinc-900"
                        : "bg-white text-zinc-700 border-zinc-300"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">
                Asunto / Título:
              </label>
              <input
                type="text"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ej: Faltante de stock o local cerrado"
                className="w-full text-xs p-2.5 rounded-lg border border-zinc-300 bg-white outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">
                Descripción detallada:
              </label>
              <textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                rows={3}
                placeholder="Detallá lo sucedido para que tu Team Leader intervenga..."
                className="w-full text-xs p-2.5 rounded-lg border border-zinc-300 bg-white outline-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCreando(false)}
                className="flex-1 py-2 text-xs font-semibold border rounded-lg text-zinc-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={guardarNueva}
                disabled={!titulo.trim() || !descripcion.trim() || guardando}
                className="flex-1 py-2 text-xs font-bold bg-[#1E2320] text-white rounded-lg hover:bg-black transition disabled:opacity-50 cursor-pointer"
              >
                {guardando ? "Enviando..." : "Reportar"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Resolver Novedad */}
      {resolviendo && (
        <Modal
          titulo="Resolver Novedad"
          abierto={!!resolviendo}
          onCerrar={() => setResolviendo(null)}
          ancho="md"
        >
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-zinc-50 border text-xs text-zinc-700">
              <p className="font-bold">{resolviendo.titulo}</p>
              <p className="mt-1">{resolviendo.descripcion}</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">
                Acción:
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAccion("CERRADA")}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg border transition cursor-pointer ${
                    accion === "CERRADA"
                      ? "bg-emerald-700 text-white border-emerald-700"
                      : "bg-white text-zinc-700 border-zinc-300"
                  }`}
                >
                  Cerrar como Resuelta
                </button>
                <button
                  type="button"
                  onClick={() => setAccion("CANCELADA")}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg border transition cursor-pointer ${
                    accion === "CANCELADA"
                      ? "bg-zinc-700 text-white border-zinc-700"
                      : "bg-white text-zinc-700 border-zinc-300"
                  }`}
                >
                  Cancelar Novedad
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">
                Resolución:
              </label>
              <textarea
                value={resolucion}
                onChange={(e) => setResolucion(e.target.value)}
                rows={3}
                placeholder="Explicá la solución o respuesta..."
                className="w-full text-xs p-2.5 rounded-lg border border-zinc-300 bg-white outline-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setResolviendo(null)}
                className="flex-1 py-2 text-xs font-semibold border rounded-lg text-zinc-700"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={confirmarResolucion}
                disabled={guardando}
                className="flex-1 py-2 text-xs font-bold bg-[#1E2320] text-white rounded-lg hover:bg-black transition cursor-pointer"
              >
                {guardando ? "Guardando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
