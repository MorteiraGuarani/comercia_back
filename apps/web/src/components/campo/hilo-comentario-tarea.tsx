"use client";

import { useEffect, useState } from "react";
import { ubicarComentario } from "@/lib/api-tareas";
import { mensajeError } from "@/utils/error";
import { PanelComentarios } from "./panel-comentarios";

/**
 * Hilo de comentarios de la tarea a la que pertenece un comentario, abierto
 * desde la campana: el repositor comenta y su líder responde ahí mismo.
 */
export function HiloComentarioTarea({ comentarioId }: { comentarioId: number }) {
  const [hilo, setHilo] = useState<{
    visitaId: number;
    tareaId: number;
    esPropia: boolean;
  } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let vigente = true;
    ubicarComentario(comentarioId)
      .then((h) => {
        if (vigente) setHilo(h);
      })
      .catch((e: unknown) => {
        if (vigente) setError(mensajeError(e, "No se pudo abrir la conversación."));
      });
    return () => {
      vigente = false;
    };
  }, [comentarioId]);

  if (error)
    return (
      <p
        role="alert"
        className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
      >
        {error}
      </p>
    );
  if (!hilo)
    return (
      <p role="status" className="py-6 text-center text-sm text-muted">
        Cargando la conversación…
      </p>
    );
  return (
    <PanelComentarios
      visitaId={hilo.visitaId}
      tareaId={hilo.tareaId}
      esLider={!hilo.esPropia}
    />
  );
}
