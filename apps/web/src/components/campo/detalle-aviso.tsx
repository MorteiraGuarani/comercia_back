"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { GaleriaAdjuntosCampo } from "./galeria-adjuntos-campo";
import type { AvisoDetalleCampo } from "@/types/campo";

export function DetalleAviso({ id }: { id: number }) {
  const [aviso, setAviso] = useState<AvisoDetalleCampo | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let activo = true;
    apiFetch<AvisoDetalleCampo>(`/campo/avisos/${id}`)
      .then(async (data) => {
        if (!data.leido) {
          await apiFetch(`/campo/avisos/${id}/marcar-leido`, { method: "PUT" }).catch(() => undefined);
        }
        if (activo) setAviso(data);
      })
      .catch((err: unknown) => { if (activo) setError(err instanceof Error ? err.message : "No se pudo abrir el aviso"); });
    return () => { activo = false; };
  }, [id]);

  if (error) return <p role="alert" className="break-words text-sm text-red-700">{error}</p>;
  if (!aviso) return <p className="py-6 text-center text-sm text-muted">Cargando aviso…</p>;

  return (
    <article className="min-w-0 space-y-3 text-foreground">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span>De {aviso.emisor.nombre} {aviso.emisor.apellido}</span>
        <time dateTime={aviso.creadoAt}>{new Date(aviso.creadoAt).toLocaleString("es-PY")}</time>
      </div>
      <p className="rounded-xl border border-line bg-surface-soft p-4 whitespace-pre-wrap break-words text-sm">{aviso.mensaje}</p>
      <GaleriaAdjuntosCampo adjuntos={aviso.adjuntos} />
    </article>
  );
}
