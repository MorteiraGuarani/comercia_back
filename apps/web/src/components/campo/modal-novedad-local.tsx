"use client";

import { mostrarToast } from "@/components/toast/toast-controller";
import { useState } from "react";
import { Modal } from "@/components/modal";
import { PantallaCarga } from "@/components/pantalla-carga";
import { crearNovedadCampo } from "@/lib/api-adjuntos-campo";
import { mensajeError } from "@/utils/error";
import { SelectorFotosCampo } from "./selector-fotos-campo";
import { SelectorTipoNovedad } from "./ui/selector-tipo-novedad";
import type { TipoNovedad } from "@/types/campo";

const campo =
  "w-full min-h-11 rounded-lg border border-line bg-surface-raised px-3 py-2 text-sm text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus";

/**
 * Reporte de una novedad de un local (local cerrado, faltante, reclamo de
 * precio…), opcionalmente ligada a una tarea. Se puede enviar con o sin la
 * entrada marcada; si hay visita en curso en el local, queda asociada.
 */
export function ModalNovedadLocal({
  local,
  visitaId,
  tarea,
  cerrar,
}: {
  local: { id: string; nombre: string };
  visitaId?: number;
  tarea?: { id: number; nombre: string };
  cerrar: () => void;
}) {
  const [tipo, setTipo] = useState<TipoNovedad>("INCIDENCIA");
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [fotos, setFotos] = useState<File[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const completo = titulo.trim().length >= 2 && descripcion.trim().length >= 3;

  async function enviar() {
    if (!completo || enviando) return;
    setEnviando(true);
    setError("");
    try {
      await crearNovedadCampo(
        {
          localId: local.id,
          tareaId: tarea?.id,
          visitaId,
          tipo,
          titulo: titulo.trim(),
          descripcion: descripcion.trim(),
        },
        fotos,
      );
      mostrarToast(
        "exito",
        "Tu supervisor ya fue notificado.",
        "Novedad enviada",
      );
      cerrar();
    } catch (e) {
      setError(mensajeError(e, "No se pudo enviar la novedad"));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      titulo={tarea ? `Novedad · ${tarea.nombre}` : `Novedad · ${local.nombre}`}
      abierto
      hojaMovil
      onCerrar={() => {
        if (!enviando) cerrar();
      }}
    >
      <form
        className="space-y-3"
        onSubmit={(evento) => {
          evento.preventDefault();
          void enviar();
        }}
      >
        <p className="text-xs text-muted">
          {tarea ? `En ${local.nombre}. ` : ""}
          Contá el imprevisto (local cerrado, faltante de stock, reclamo de
          precio…) para que tu supervisor intervenga.
        </p>

        <fieldset disabled={enviando} className="min-w-0">
          <legend className="mb-1 text-xs font-semibold text-foreground">
            Tipo
          </legend>
          <SelectorTipoNovedad valor={tipo} onCambiar={setTipo} />
        </fieldset>

        <div>
          <label
            htmlFor="novedad-titulo"
            className="mb-1 block text-xs font-semibold text-foreground"
          >
            Asunto
          </label>
          <input
            id="novedad-titulo"
            type="text"
            value={titulo}
            maxLength={120}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ej.: local cerrado por inventario"
            disabled={enviando}
            className={campo}
          />
        </div>

        <div>
          <label
            htmlFor="novedad-descripcion"
            className="mb-1 block text-xs font-semibold text-foreground"
          >
            Descripción
          </label>
          <textarea
            id="novedad-descripcion"
            value={descripcion}
            rows={3}
            maxLength={1000}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Detallá lo que pasó"
            disabled={enviando}
            className={`${campo} resize-y`}
          />
        </div>

        <SelectorFotosCampo
          archivos={fotos}
          onChange={setFotos}
          disabled={enviando}
        />

        {error ? (
          <p
            role="alert"
            className="rounded-lg bg-red-50 p-2.5 text-sm text-red-700 dark:bg-red-950/60 dark:text-red-200"
          >
            {error}
          </p>
        ) : null}

        <div className="flex flex-col-reverse gap-2 border-t border-line pt-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={cerrar}
            disabled={enviando}
            className="min-h-11 cursor-pointer whitespace-nowrap rounded-lg border border-line px-4 text-sm font-semibold text-foreground hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!completo || enviando}
            className="min-h-11 cursor-pointer whitespace-nowrap rounded-lg bg-foreground px-4 text-sm font-semibold text-background hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Enviar novedad
          </button>
        </div>
      </form>
      <PantallaCarga visible={enviando} mensaje="Enviando novedad" />
    </Modal>
  );
}
