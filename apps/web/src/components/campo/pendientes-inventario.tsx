"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { PantallaCarga } from "@/components/pantalla-carga";
import { confirmar } from "@/components/confirmacion/confirmacion-controller";
import {
  descargarCopia,
  descartarPendiente,
  listarPendientes,
  reintentarPendientes,
} from "@/lib/inventario-db";
import { useEnLinea } from "@/hooks/use-en-linea";
import { mensajeError } from "@/utils/error";
import type { PendienteInventario } from "@/types/inventario";

const SIN_PENDIENTES: PendienteInventario[] = [];

const etiqueta = (p: PendienteInventario) =>
  p.tipo === "agregar"
    ? `Agregar ${p.itemname}`
    : p.tipo === "quitar"
      ? `Quitar ${p.itemcode}`
      : `Carga de ${p.cargas.length} ${p.cargas.length === 1 ? "producto" : "productos"}`;

/** Cambios de inventario guardados en el equipo que todavía no llegaron al servidor. */
export function PendientesInventario({
  usuarioId,
  localId,
}: {
  usuarioId: number;
  /** Solo los de este local; sin él, todos. */
  localId?: string;
}) {
  const enLinea = useEnLinea();
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const pendientes =
    useLiveQuery(
      () =>
        listarPendientes(usuarioId)
          .then((ps) => (localId ? ps.filter((p) => p.localId === localId) : ps))
          .catch(() => SIN_PENDIENTES),
      [usuarioId, localId],
    ) ?? SIN_PENDIENTES;
  if (!pendientes.length) return null;
  const revisar = pendientes.filter((p) => p.estado === "REVISAR");

  return (
    <aside
      aria-live="polite"
      className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
    >
      <PantallaCarga visible={enviando} mensaje="Enviando inventario" />
      <p className="font-semibold">
        {pendientes.length} {pendientes.length === 1 ? "cambio guardado" : "cambios guardados"} en
        este equipo sin enviar
      </p>
      <p>
        {enLinea
          ? "Se envían solos en segundo plano."
          : "Se envían solos cuando vuelva la conexión."}
      </p>
      {error ? <p role="alert">{error}</p> : null}
      {revisar.length ? (
        <>
          <ul className="divide-y divide-amber-200 dark:divide-amber-800">
            {revisar.slice(0, 7).map((p) => (
              <li key={p.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="break-words font-semibold">
                    {p.localNombre} · {etiqueta(p)}
                  </p>
                  {p.error ? <p className="break-words text-xs">{p.error}</p> : null}
                </div>
                <button
                  type="button"
                  className="min-h-11 cursor-pointer whitespace-nowrap rounded-lg px-3 hover:bg-amber-100 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus dark:hover:bg-amber-900"
                  onClick={async () => {
                    if (
                      !(await confirmar({
                        titulo: "Descartar cambio",
                        mensaje:
                          "El servidor no aceptó este cambio. ¿Descartarlo? Se borra solo de este equipo.",
                        textoConfirmar: "Descartar",
                        peligro: true,
                      }))
                    )
                      return;
                    await descartarPendiente(usuarioId, p.id);
                    // La copia tenía el cambio aplicado: se vuelve a descargar.
                    if (navigator.onLine) void descargarCopia(usuarioId).catch(() => undefined);
                  }}
                >
                  Descartar
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled={enviando || !enLinea}
            className="min-h-11 cursor-pointer whitespace-nowrap rounded-lg border border-current px-3 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-amber-900"
            onClick={async () => {
              setEnviando(true);
              setError("");
              try {
                await reintentarPendientes(usuarioId);
              } catch (e) {
                setError(mensajeError(e, "No se pudo enviar"));
              } finally {
                setEnviando(false);
              }
            }}
          >
            Reintentar envío
          </button>
        </>
      ) : null}
    </aside>
  );
}
