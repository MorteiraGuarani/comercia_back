"use client";
import { useCallback, useEffect, useState } from "react";
import { usePanel } from "@/components/panel/contexto";
import {
  descartarPendiente,
  listarPendientes,
  observarPendientes,
  reintentarPendientes,
  sincronizarPendientes,
} from "@/lib/pendientes-tareas";
import type { AccionTareaPendiente } from "@/types/pendientes-tareas";

export function PendientesTareas({
  onSincronizar,
}: {
  onSincronizar?: () => void;
}) {
  const { usuario } = usePanel();
  const [pendientes, setPendientes] = useState<AccionTareaPendiente[]>([]);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const cargar = useCallback(() => {
    void listarPendientes(usuario.id)
      .then(setPendientes)
      .catch((e) =>
        setError(
          e instanceof Error ? e.message : "No se pudieron leer los pendientes",
        ),
      );
  }, [usuario.id]);
  useEffect(() => {
    cargar();
    return observarPendientes(cargar);
  }, [cargar]);
  useEffect(() => {
    let vivo = true;
    const enviar = async () => {
      try {
        const antes = (await listarPendientes(usuario.id)).length;
        if (!antes) return;
        await sincronizarPendientes(usuario.id);
        if (vivo && (await listarPendientes(usuario.id)).length < antes)
          onSincronizar?.();
      } catch {
        /* El pendiente conserva el error y puede reintentarse. */
      }
    };
    void enviar();
    const t = setInterval(() => {
      if (!document.hidden) void enviar();
    }, 15000);
    window.addEventListener("online", enviar);
    return () => {
      vivo = false;
      clearInterval(t);
      window.removeEventListener("online", enviar);
    };
  }, [usuario.id, onSincronizar]);
  if (!pendientes.length && !error) return null;
  return (
    <aside
      className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
      aria-live="polite"
    >
      <p className="font-semibold">
        {pendientes.length} acciones guardadas en este dispositivo
      </p>
      <p>
        Siguen pendientes: aún no cuentan como tareas completadas ni fotos
        recibidas por el supervisor.
      </p>
      {error ? <p role="alert">{error}</p> : null}
      <button
        type="button"
        disabled={enviando}
        className="min-h-11 rounded-lg border border-current px-3 hover:bg-amber-100 disabled:opacity-50 dark:hover:bg-amber-900"
        onClick={async () => {
          setEnviando(true);
          try {
            await reintentarPendientes(usuario.id);
            cargar();
            onSincronizar?.();
          } catch (e) {
            setError(e instanceof Error ? e.message : "No se pudo sincronizar");
          } finally {
            setEnviando(false);
          }
        }}
      >
        {enviando ? "Sincronizando…" : "Sincronizar pendientes"}
      </button>
      <details>
        <summary className="flex min-h-11 cursor-pointer items-center hover:underline">
          Revisar acciones
        </summary>
        <ul className="divide-y divide-amber-200 dark:divide-amber-800">
          {pendientes.slice(0, 7).map((p) => (
            <li key={p.id} className="py-2">
              <p>
                {p.etiqueta} ·{" "}
                {p.estado === "REVISAR" ? "Necesita revisión" : "Pendiente"}
              </p>
              {p.error ? <p className="text-xs">{p.error}</p> : null}
              <button
                type="button"
                className="min-h-11 hover:underline"
                onClick={async () => {
                  if (
                    confirm(
                      "¿Descartar esta acción pendiente? Se eliminará solo del dispositivo.",
                    )
                  ) {
                    await descartarPendiente(usuario.id, p.id);
                    cargar();
                  }
                }}
              >
                Descartar
              </button>
            </li>
          ))}
        </ul>
        {pendientes.length > 7 ? (
          <p>
            Se muestran las primeras 7 acciones. El resto se conserva para
            sincronización.
          </p>
        ) : null}
      </details>
    </aside>
  );
}
