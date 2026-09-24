"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { usePanel } from "@/components/panel/contexto";
import { GaleriaAdjuntosCampo } from "./galeria-adjuntos-campo";
import type { NovedadCampoItem, RespuestaNovedadCampo } from "@/types/campo";
import type { RespuestaPaginada } from "@/types/paginacion";

export function HiloNovedad({ id, onActualizado }: { id: number; onActualizado?: () => void }) {
  const { usuario, modulos } = usePanel();
  const puedeGestionar = modulos.some((modulo) => modulo.ruta === "gestion-campo");
  const [novedad, setNovedad] = useState<NovedadCampoItem | null>(null);
  const [respuestas, setRespuestas] = useState<RespuestaPaginada<RespuestaNovedadCampo> | null>(null);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [mensaje, setMensaje] = useState("");
  const [resolucion, setResolucion] = useState("");
  const [confirmandoCierre, setConfirmandoCierre] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let activo = true;
    Promise.all([
      apiFetch<NovedadCampoItem>(`/campo/novedades/${id}`),
      apiFetch<RespuestaPaginada<RespuestaNovedadCampo>>(`/campo/novedades/${id}/respuestas?page=${page}&limit=20`),
    ]).then(([detalle, hilo]) => {
      if (!activo) return;
      setNovedad(detalle);
      setRespuestas(hilo);
      setError("");
    }).catch((err: unknown) => {
      if (activo) setError(err instanceof Error ? err.message : "No se pudo cargar la novedad");
    }).finally(() => {
      if (activo) setCargando(false);
    });
    return () => { activo = false; };
  }, [id, page, revision]);

  const responder = async () => {
    if (!mensaje.trim() || guardando) return;
    setGuardando(true);
    setError("");
    try {
      await apiFetch(`/campo/novedades/${id}/respuestas`, {
        method: "POST",
        body: JSON.stringify({ mensaje: mensaje.trim() }),
      });
      setMensaje("");
      setPage(1);
      setRevision((actual) => actual + 1);
      onActualizado?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "No se pudo enviar la respuesta");
    } finally {
      setGuardando(false);
    }
  };

  const cerrar = async () => {
    if (!novedad || guardando) return;
    setGuardando(true);
    setError("");
    try {
      await apiFetch(`/campo/novedades/${id}/estado`, {
        method: "PUT",
        body: JSON.stringify({
          estado: puedeGestionar ? "CERRADA" : "CANCELADA",
          resolucion: resolucion.trim(),
        }),
      });
      setConfirmandoCierre(false);
      setRevision((actual) => actual + 1);
      onActualizado?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "No se pudo cerrar la novedad");
    } finally {
      setGuardando(false);
    }
  };

  if (cargando && !novedad) return <p className="py-8 text-center text-sm text-muted">Cargando conversación…</p>;
  if (!novedad) return <p role="alert" className="py-6 text-sm text-red-700">{error || "Novedad no disponible"}</p>;

  const puedeCerrar = novedad.estado === "ABIERTA" && (puedeGestionar || novedad.usuario.id === usuario.id);

  return (
    <div className="min-w-0 space-y-4 text-foreground">
      <div className="min-w-0 rounded-xl border border-line bg-surface-soft p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="min-w-0 break-words text-base font-bold">{novedad.titulo}</h2>
          <span className="rounded-full border border-line px-2 py-1 text-xs font-semibold">{novedad.estado}</span>
        </div>
        <p className="mt-1 break-words text-xs text-muted">{novedad.local.cliente?.nombre} · {novedad.local.nombre} · {novedad.usuario.nombre} {novedad.usuario.apellido}</p>
        <p className="mt-3 whitespace-pre-wrap break-words text-sm">{novedad.descripcion}</p>
        <GaleriaAdjuntosCampo adjuntos={novedad.adjuntos} />
      </div>

      <section aria-label="Respuestas de la novedad" className="space-y-2">
        <h3 className="text-sm font-semibold">Conversación {respuestas ? `(${respuestas.total})` : ""}</h3>
        {respuestas?.items.length ? [...respuestas.items].reverse().map((respuesta) => (
          <article key={respuesta.id} className="min-w-0 rounded-xl border border-line bg-surface-raised p-3">
            <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
              <strong>{respuesta.usuario.nombre} {respuesta.usuario.apellido}</strong>
              <time className="text-muted" dateTime={respuesta.creadoAt}>{new Date(respuesta.creadoAt).toLocaleString("es-PY")}</time>
            </div>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm">{respuesta.mensaje}</p>
          </article>
        )) : <p className="text-sm text-muted">Aún no hay respuestas.</p>}
        {respuestas && respuestas.totalPages > 1 && (
          <div className="flex items-center justify-between gap-2 text-xs">
            <button type="button" disabled={page >= respuestas.totalPages} onClick={() => setPage((actual) => actual + 1)} className="min-h-10 rounded-lg border border-line px-3 disabled:opacity-50">Anteriores</button>
            <span>Página {page} de {respuestas.totalPages}</span>
            <button type="button" disabled={page <= 1} onClick={() => setPage((actual) => actual - 1)} className="min-h-10 rounded-lg border border-line px-3 disabled:opacity-50">Recientes</button>
          </div>
        )}
      </section>

      {novedad.resolucion && <div className="rounded-xl border border-line bg-surface-soft p-3 text-sm"><strong>Resolución:</strong> <span className="break-words">{novedad.resolucion}</span></div>}
      {error && <p role="alert" className="break-words rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">{error}</p>}

      {novedad.estado === "ABIERTA" && (
        <div className="space-y-2 border-t border-line pt-3">
          <label htmlFor={`respuesta-novedad-${id}`} className="block text-sm font-semibold">Responder</label>
          <textarea id={`respuesta-novedad-${id}`} value={mensaje} maxLength={1000} onChange={(event) => setMensaje(event.target.value)} rows={3} placeholder="Escribe una respuesta…" className="w-full min-w-0 rounded-lg border border-line bg-surface-raised p-3 text-sm text-foreground" />
          <button type="button" onClick={() => void responder()} disabled={guardando || !mensaje.trim()} className="min-h-11 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white disabled:opacity-50 dark:bg-brand-200 dark:text-brand-950">{guardando ? "Enviando…" : "Enviar respuesta"}</button>
        </div>
      )}

      {puedeCerrar && (
        <div className="sticky bottom-0 z-10 rounded-xl border border-line bg-surface-raised p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lg">
          {!confirmandoCierre ? (
            <button type="button" onClick={() => setConfirmandoCierre(true)} className="min-h-11 w-full cursor-pointer rounded-lg border border-line px-4 text-sm font-semibold text-foreground hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 sm:w-auto">{puedeGestionar ? "Cerrar novedad resuelta" : "Cancelar mi novedad"}</button>
          ) : (
            <div className="space-y-2">
              <label htmlFor={`cierre-novedad-${id}`} className="block text-sm font-semibold">{puedeGestionar ? "Resolución final" : "Motivo de cancelación"}</label>
              <textarea id={`cierre-novedad-${id}`} value={resolucion} maxLength={1000} onChange={(event) => setResolucion(event.target.value)} rows={2} className="w-full min-w-0 rounded-lg border border-line bg-surface-raised p-2 text-sm text-foreground" />
              <div className="grid grid-cols-2 gap-2 sm:flex">
                <button type="button" onClick={() => setConfirmandoCierre(false)} className="min-h-11 cursor-pointer rounded-lg border border-line px-3 text-sm text-foreground hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600">Volver</button>
                <button type="button" onClick={() => void cerrar()} disabled={guardando} className="min-h-11 cursor-pointer rounded-lg bg-brand-700 px-3 text-sm font-semibold text-white hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-brand-200 dark:text-brand-950 dark:hover:bg-brand-300">Confirmar cierre</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
