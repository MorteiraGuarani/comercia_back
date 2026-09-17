"use client";

import React, { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { TOKENS } from "./tokens";
import { StatusStamp } from "./ui/status-stamp";
import { TopBar } from "./ui/top-bar";
import { Modal } from "@/components/modal";
import { PantallaCarga } from "@/components/pantalla-carga";
import { SelectorPaginado } from "@/components/selector-paginado";
import { Paginacion } from "@/components/paginacion";
import { IconoMas } from "@/components/icono-mas";
import type {
  NovedadCampoItem,
  NovedadesResponse,
  TipoNovedad,
  EstadoNovedad,
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
  const [revision, setRevision] = useState(0);
  const [consultaTerminada, setConsultaTerminada] = useState("");
  const [error, setError] = useState("");
  const [errorFormulario, setErrorFormulario] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(7);
  const [paginacion, setPaginacion] = useState({ total: 0, totalPages: 1 });

  // Modal para crear novedad
  const [creando, setCreando] = useState(false);
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

  const consulta = `${filtro}|${page}|${limit}|${revision}`;
  const cargando = consulta !== consultaTerminada;
  const cargar = () => setRevision((n) => n + 1);
  useEffect(() => {
    let vigente = true;
    apiFetch<NovedadesResponse>(`/campo/novedades?estado=${filtro}&page=${page}&limit=${limit}`)
      .then((res) => {
        if (!vigente) return;
        setNovedades(res.items);
        setCounts(res.counts);
        setPaginacion({ total: res.total, totalPages: res.totalPages });
        setError("");
        if (page > res.totalPages) setPage(res.totalPages);
      })
      .catch((e: unknown) => { if (vigente) setError(e instanceof Error ? e.message : "Error al cargar novedades"); })
      .finally(() => { if (vigente) setConsultaTerminada(consulta); });
    return () => { vigente = false; };
  }, [filtro, page, limit, consulta]);

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
      setErrorFormulario("");
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
    } catch (e: unknown) {
      setErrorFormulario(e instanceof Error ? e.message : "No se pudo enviar la novedad");
    } finally {
      setGuardando(false);
    }
  };

  const confirmarResolucion = async () => {
    if (!resolviendo || guardando) return;
    try {
      setGuardando(true);
      setErrorFormulario("");
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
    } catch (e: unknown) {
      setErrorFormulario(e instanceof Error ? e.message : "No se pudo guardar la resolución");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div
      className="campo-screen min-w-0 w-full min-h-[calc(100vh-5rem)] flex flex-col font-sans"
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
              onClick={() => { setErrorFormulario(""); setCreando(true); }}
              aria-label="Crear novedad"
              title="Crear novedad"
              className="grid h-11 w-11 place-items-center rounded-lg text-white transition hover:brightness-110"
              style={{ background: TOKENS.carne }}
            >
              <IconoMas />
            </button>
          )
        }
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5 flex-1 overflow-y-auto w-full">
        {/* Pestañas de estado (Abiertas, Cerradas, Canceladas) */}
        <div className="flex min-w-0 gap-1 border-b border-line">
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
                onClick={() => { setFiltro(st); setPage(1); }}
                aria-pressed={isActive}
                className="min-w-0 flex-1 ft-body text-xs sm:text-sm font-semibold min-h-11 px-1 border-b-2 transition-colors hover:bg-surface-soft"
                style={{
                  color: isActive ? colors[st] : TOKENS.sub,
                  borderColor: isActive ? colors[st] : "transparent",
                }}
              >
                {labels[st]} ({count})
              </button>
            );
          })}
        </div>

        {cargando ? (
          <div className="py-16 text-center text-sm sm:text-base text-muted font-mono">
            Cargando novedades...
          </div>
        ) : error ? (
          <div className="p-5 rounded-2xl bg-red-50 text-red-700 text-sm sm:text-base font-semibold">
            {error}
          </div>
        ) : novedades.length === 0 ? (
          <div
            className="rounded-2xl p-12 text-center bg-surface-raised"
            style={{ border: `1px solid ${TOKENS.line}` }}
          >
            <p
              className="ft-display text-2xl font-bold mb-1"
              style={{ color: TOKENS.ink }}
            >
              Sin novedades {filtro.toLowerCase()}s
            </p>
            <p className="ft-body text-sm sm:text-base text-muted">
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
                  className="rounded-xl p-4 sm:p-5 flex flex-col justify-between bg-surface-raised shadow-xs hover:shadow-md transition-all"
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

                    <p className="ft-body text-sm sm:text-base font-bold mb-1.5 text-foreground leading-snug">
                      {n.titulo}
                    </p>
                    <p className="ft-body text-xs sm:text-sm leading-relaxed text-foreground">
                      {n.descripcion}
                    </p>

                    {n.resolucion && (
                      <div
                        className="mt-3 p-3 rounded-xl bg-surface-soft border text-sm"
                        style={{ borderColor: TOKENS.line }}
                      >
                        <p className="font-bold text-xs sm:text-sm text-foreground">
                          Resolución:
                        </p>
                        <p className="text-foreground italic text-xs sm:text-sm mt-0.5">
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
                            setErrorFormulario("");
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
        <Paginacion page={page} limit={limit} total={paginacion.total} totalPages={paginacion.totalPages} onPageChange={setPage} onLimitChange={(n) => { setLimit(n); setPage(1); }} />
      </div>

      <PantallaCarga visible={guardando} mensaje={creando ? "Enviando novedad" : "Guardando resolución"} />

      {/* Modal Crear Novedad */}
      {creando && (
        <Modal
          titulo="Reportar Nueva Novedad"
          abierto={creando}
          onCerrar={() => { if (!guardando) setCreando(false); }}
          ancho="md"
        >
          <div className="space-y-3">
            {errorFormulario && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">{errorFormulario}</p>}
            <SelectorPaginado url="/campo/novedades/locales" etiqueta="Local" buscable required value={localSeleccionado ?? ""} onChange={(id) => setLocalSeleccionado(id === "" ? null : id)} />

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
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
                        : "bg-surface-raised text-foreground border-line"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Asunto / Título:
              </label>
              <input
                type="text"
                maxLength={120}
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ej: Faltante de stock o local cerrado"
                className="w-full text-xs p-2.5 rounded-lg border border-line bg-surface-raised outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Descripción detallada:
              </label>
              <textarea
                maxLength={1000}
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                rows={3}
                placeholder="Detallá lo sucedido para que tu Team Leader intervenga..."
                className="w-full text-xs p-2.5 rounded-lg border border-line bg-surface-raised outline-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCreando(false)}
                className="flex-1 py-2 text-xs font-semibold border rounded-lg text-foreground"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={guardarNueva}
                disabled={!localSeleccionado || titulo.trim().length < 2 || descripcion.trim().length < 3 || guardando}
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
          onCerrar={() => { if (!guardando) setResolviendo(null); }}
          ancho="md"
        >
          <div className="space-y-3">
            {errorFormulario && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">{errorFormulario}</p>}
            <div className="p-3 rounded-lg bg-surface-soft border text-xs text-foreground">
              <p className="font-bold">{resolviendo.titulo}</p>
              <p className="mt-1">{resolviendo.descripcion}</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Acción:
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAccion("CERRADA")}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg border transition cursor-pointer ${
                    accion === "CERRADA"
                      ? "bg-emerald-700 text-white border-emerald-700"
                      : "bg-surface-raised text-foreground border-line"
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
                      : "bg-surface-raised text-foreground border-line"
                  }`}
                >
                  Cancelar Novedad
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Resolución:
              </label>
              <textarea
                value={resolucion}
                onChange={(e) => setResolucion(e.target.value)}
                rows={3}
                placeholder="Explicá la solución o respuesta..."
                className="w-full text-xs p-2.5 rounded-lg border border-line bg-surface-raised outline-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setResolviendo(null)}
                className="flex-1 py-2 text-xs font-semibold border rounded-lg text-foreground"
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
