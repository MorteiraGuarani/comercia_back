"use client";

import { useState, useEffect } from "react";
import { crearComentario, listarComentarios, marcarComentarioLeido } from "@/lib/api-tareas";
import type { ComentarioTarea } from "@/types/campo";
import { mostrarToast } from "@/components/toast/toast-controller";

interface PanelComentariosProps {
  visitaId: number;
  tareaId: number;
  esLider?: boolean;
}

export function PanelComentarios({ visitaId, tareaId, esLider = false }: PanelComentariosProps) {
  const [comentarios, setComentarios] = useState<ComentarioTarea[]>([]);
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [texto, setTexto] = useState("");

  useEffect(() => {
    let activo = true;
    listarComentarios(visitaId, tareaId)
      .then((data) => {
        if (activo) setComentarios(data);
      })
      .catch(() => {
        if (activo) mostrarToast("error", "Error al cargar comentarios");
      })
      .finally(() => {
        if (activo) setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, [visitaId, tareaId]);

  const handleEnviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!texto.trim()) return;

    setEnviando(true);
    try {
      await crearComentario(visitaId, tareaId, { comentario: texto.trim() });
      setTexto("");
      mostrarToast("exito", "Comentario enviado");
      const data = await listarComentarios(visitaId, tareaId);
      setComentarios(data);
    } catch {
      mostrarToast("error", "Error al enviar comentario");
    } finally {
      setEnviando(false);
    }
  };

  const handleMarcarLeido = async (comentarioId: number) => {
    try {
      await marcarComentarioLeido(comentarioId);
      const data = await listarComentarios(visitaId, tareaId);
      setComentarios(data);
    } catch {
      mostrarToast("error", "Error al marcar como leído");
    }
  };

  if (cargando) {
    return (
      <div className="p-4 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Lista de comentarios */}
      {comentarios.length === 0 ? (
        <p className="text-center text-gray-500 dark:text-gray-400 py-8">
          No hay comentarios aún
        </p>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {comentarios.map((c) => (
            <div
              key={c.id}
              className={`p-3 rounded-lg border ${
                c.leidoPorLider
                  ? "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                  : "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className="font-medium text-sm text-gray-900 dark:text-white">
                    {c.usuario.nombre} {c.usuario.apellido}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(c.creadoAt).toLocaleString("es-PY")}
                  </p>
                </div>
                {esLider && !c.leidoPorLider && (
                  <button
                    type="button"
                    onClick={() => handleMarcarLeido(c.id)}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
                  >
                    Marcar leído
                  </button>
                )}
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {c.comentario}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Formulario para nuevo comentario */}
      {!esLider && (
        <form onSubmit={handleEnviar} className="space-y-3">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Escribe un comentario..."
            maxLength={500}
            rows={3}
            disabled={enviando}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
              bg-white dark:bg-gray-800 text-gray-900 dark:text-white
              placeholder-gray-400 dark:placeholder-gray-500
              focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400
              disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {texto.length}/500
            </p>
            <button
              type="submit"
              disabled={enviando || !texto.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600
                text-white rounded-lg text-sm font-medium
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors"
            >
              {enviando ? "Enviando..." : "Enviar comentario"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
