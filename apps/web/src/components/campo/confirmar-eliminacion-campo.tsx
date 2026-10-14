"use client";

import { useState } from "react";
import { Modal } from "@/components/modal";

interface Props {
  tipo: "cliente" | "local";
  nombre: string;
  cantidadLocales?: number;
  procesando: boolean;
  error: string | null;
  onCerrar: () => void;
  onConfirmar: (eliminarLocales: boolean) => void;
}

export function ConfirmarEliminacionCampo({
  tipo, nombre, cantidadLocales = 0, procesando, error, onCerrar, onConfirmar,
}: Props) {
  const [eliminarLocales, setEliminarLocales] = useState(false);
  return (
    <Modal titulo={`Eliminar ${tipo}`} abierto onCerrar={() => { if (!procesando) onCerrar(); }}>
      <form className="space-y-4" onSubmit={(evento) => {
        evento.preventDefault();
        if (!procesando) onConfirmar(eliminarLocales);
      }}>
        <p className="break-words text-sm text-foreground dark:text-foreground">
          ¿Eliminar <strong>{nombre}</strong> del catálogo?
        </p>
        {tipo === "cliente" && cantidadLocales > 0 ? (
          <fieldset disabled={procesando} className="min-w-0 space-y-2">
            <legend className="mb-2 text-sm font-semibold text-foreground dark:text-foreground">
              Tiene {cantidadLocales} {cantidadLocales === 1 ? "local asociado" : "locales asociados"}. ¿Qué querés hacer?
            </legend>
            {[false, true].map((borrar) => (
              <label key={String(borrar)} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-line bg-surface-raised p-3 text-sm text-foreground hover:bg-surface-soft focus-within:ring-2 focus-within:ring-brand-600 dark:border-line dark:bg-surface-raised dark:text-foreground dark:hover:bg-surface-soft">
                <input type="radio" name="destino-locales" value={borrar ? "eliminar" : "conservar"} checked={eliminarLocales === borrar} onChange={() => setEliminarLocales(borrar)} className="mt-1 h-4 w-4 shrink-0 accent-[var(--campo-carne)]" />
                <span className="min-w-0">
                  <strong className="block">{borrar ? "Eliminar también los locales" : "Conservar los locales"}</strong>
                  <span className="mt-1 block text-xs text-muted dark:text-muted">
                    {borrar
                      ? "Se quitarán de PDV y rutas. Se conservarán sus marcaciones y evidencias históricas."
                      : "Seguirán en PDV y rutas como «Sin cliente». Podés asociar un nuevo cliente desde Editar local."}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
        ) : (
          <p className="text-sm text-muted dark:text-muted">
            {tipo === "local"
              ? "El local dejará de aparecer en PDV y rutas. Se conservarán sus marcaciones y evidencias históricas."
              : "Este cliente no tiene locales asociados y dejará de aparecer en el catálogo."}
          </p>
        )}
        {error && <p role="alert" className="text-sm text-[var(--campo-critico)] dark:text-[var(--campo-critico)]">{error}</p>}
        <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end dark:border-line">
          <button type="button" onClick={onCerrar} disabled={procesando} className="min-h-11 cursor-pointer whitespace-nowrap rounded-lg border border-line px-4 text-sm font-semibold text-foreground hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-line dark:text-foreground dark:hover:bg-surface-soft">Cancelar</button>
          <button type="submit" disabled={procesando} className="min-h-11 cursor-pointer whitespace-nowrap rounded-lg bg-[var(--campo-critico)] px-4 text-sm font-semibold text-white hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--campo-critico)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[var(--campo-critico)] dark:text-[#1e2320] dark:focus-visible:ring-[var(--campo-critico)]">
            {procesando ? "Eliminando…" : tipo === "cliente" && cantidadLocales > 0 && eliminarLocales ? "Eliminar cliente y locales" : `Eliminar ${tipo}`}
          </button>
        </div>
      </form>
    </Modal>
  );
}
