"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Modal } from "@/components/modal";
import { PantallaCarga } from "@/components/pantalla-carga";
import { mostrarToast } from "@/components/toast/toast-controller";
import { useOperacionCampo } from "@/hooks/use-lista-campo";
import { mensajeError } from "@/utils/error";

/** Días antes del vencimiento en que se avisa por el inventario de los locales. */
export function ConfigVencimientosModal({ onCerrar }: { onCerrar: () => void }) {
  const op = useOperacionCampo();
  const [dias, setDias] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const control = new AbortController();
    apiFetch<{ diasAviso: number }>("/campo/inventario/configuracion", {
      signal: control.signal,
    })
      .then((c) => setDias(String(c.diasAviso)))
      .catch((e: unknown) => {
        if (!control.signal.aborted)
          setError(mensajeError(e, "No se pudo leer la configuración"));
      });
    return () => control.abort();
  }, []);

  return (
    <>
      <Modal titulo="Avisos de vencimiento" abierto onCerrar={onCerrar}>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await op.ejecutar("Guardando configuración", () =>
              apiFetch("/campo/inventario/configuracion", {
                method: "PUT",
                body: JSON.stringify({ diasAviso: Number(dias) }),
              }),
            );
            if (!ok) return;
            mostrarToast("exito", `Se avisará ${dias} días antes del vencimiento.`);
            onCerrar();
          }}
        >
          <p className="text-sm text-muted">
            Cuando un producto cargado en el inventario de un local está por
            vencer, avisamos en la campana a quien lo cargó, al personal del local
            y a sus jefes.
          </p>
          {error || op.error ? (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
            >
              {error || op.error}
            </p>
          ) : null}
          <label className="block space-y-1.5 text-sm font-semibold">
            <span>Avisar con anticipación de (días)</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={90}
              required
              disabled={!dias && !error}
              value={dias}
              onChange={(e) => setDias(e.target.value)}
              className="min-h-11 w-32 rounded-lg border border-line bg-surface px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:border-line dark:bg-surface dark:text-foreground"
            />
          </label>
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <button
              type="button"
              onClick={onCerrar}
              className="min-h-11 cursor-pointer rounded-lg border border-line px-4 text-sm font-semibold text-foreground hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!dias || !!op.mensaje}
              className="min-h-11 cursor-pointer rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-brand-500 dark:text-zinc-950 dark:hover:bg-brand-400"
            >
              Guardar
            </button>
          </div>
        </form>
      </Modal>
      <PantallaCarga visible={!!op.mensaje} mensaje={op.mensaje ?? "Procesando"} />
    </>
  );
}
