"use client";

import { useState, useEffect } from "react";
import {
  listarNotificaciones,
  marcarNotificacionLeida,
  marcarTodasNotificacionesLeidas,
  obtenerContadorNoLeidas,
} from "@/lib/api-tareas";
import type { Notificacion } from "@/types/campo";
import { mostrarToast } from "@/components/toast/toast-controller";
import { Modal } from "@/components/modal";

export function BadgeNotificaciones() {
  const [noLeidas, setNoLeidas] = useState(0);
  const [mostrarPanel, setMostrarPanel] = useState(false);

  const cargarContador = async () => {
    try {
      const data = await obtenerContadorNoLeidas();
      setNoLeidas(data.noLeidas);
    } catch (error) {
      // Silencioso, no mostrar error en badge
    }
  };

  useEffect(() => {
    cargarContador();
    // Recargar cada 30 segundos
    const interval = setInterval(cargarContador, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setMostrarPanel(true)}
        className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        aria-label={`Notificaciones${noLeidas > 0 ? ` (${noLeidas} sin leer)` : ""}`}
        title="Notificaciones"
      >
        <svg
          className="w-6 h-6 text-gray-700 dark:text-gray-300"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {noLeidas > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-600 rounded-full">
            {noLeidas > 9 ? "9+" : noLeidas}
          </span>
        )}
      </button>

      {mostrarPanel && (
        <PanelNotificaciones
          onCerrar={() => {
            setMostrarPanel(false);
            cargarContador();
          }}
        />
      )}
    </>
  );
}

interface PanelNotificacionesProps {
  onCerrar: () => void;
}

function PanelNotificaciones({ onCerrar }: PanelNotificacionesProps) {
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [soloNoLeidas, setSoloNoLeidas] = useState(true);

  const cargarNotificaciones = async () => {
    setCargando(true);
    try {
      const data = await listarNotificaciones(page, 7, soloNoLeidas ? false : undefined);
      setNotificaciones(data.items);
      setTotalPages(data.totalPages);
    } catch (error) {
      mostrarToast("error", "Error al cargar notificaciones");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarNotificaciones();
  }, [page, soloNoLeidas]);

  const handleMarcarLeida = async (id: number) => {
    try {
      await marcarNotificacionLeida(id);
      await cargarNotificaciones();
    } catch (error) {
      mostrarToast("error", "Error al marcar como leída");
    }
  };

  const handleMarcarTodasLeidas = async () => {
    try {
      const result = await marcarTodasNotificacionesLeidas();
      mostrarToast("exito", `${result.marcadas} notificaciones marcadas como leídas`);
      await cargarNotificaciones();
    } catch (error) {
      mostrarToast("error", "Error al marcar todas como leídas");
    }
  };

  return (
    <Modal titulo="Notificaciones" onCerrar={onCerrar} ancho="max-w-2xl">
      <div className="space-y-4">
        {/* Controles */}
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-gray-200 dark:border-gray-700">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={soloNoLeidas}
              onChange={(e) => {
                setSoloNoLeidas(e.target.checked);
                setPage(1);
              }}
              className="rounded"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Solo no leídas
            </span>
          </label>
          <button
            type="button"
            onClick={handleMarcarTodasLeidas}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            Marcar todas como leídas
          </button>
        </div>

        {/* Lista de notificaciones */}
        {cargando ? (
          <div className="py-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : notificaciones.length === 0 ? (
          <p className="text-center text-gray-500 dark:text-gray-400 py-8">
            No hay notificaciones
          </p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {notificaciones.map((n) => (
              <div
                key={n.id}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  n.leido
                    ? "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                    : "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                }`}
                onClick={() => !n.leido && handleMarcarLeida(n.id)}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="font-medium text-sm text-gray-900 dark:text-white">
                    {n.titulo}
                  </p>
                  <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {new Date(n.creadoAt).toLocaleDateString("es-PY")}
                  </span>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {n.mensaje}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {n.usuarioEmisor.nombre} {n.usuarioEmisor.apellido}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-4">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 rounded border border-gray-300 dark:border-gray-600
                disabled:opacity-50 disabled:cursor-not-allowed
                hover:bg-gray-100 dark:hover:bg-gray-700
                text-sm"
            >
              Anterior
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Página {page} de {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 rounded border border-gray-300 dark:border-gray-600
                disabled:opacity-50 disabled:cursor-not-allowed
                hover:bg-gray-100 dark:hover:bg-gray-700
                text-sm"
            >
              Siguiente
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
