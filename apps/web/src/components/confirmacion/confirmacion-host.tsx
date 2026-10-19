"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/modal";
import { registrarHostConfirmacion } from "./confirmacion-controller";
import type { ConfirmacionPendiente } from "@/types/confirmacion";

/** Se monta una vez en el layout raíz y muestra las confirmaciones de la app. */
export function ConfirmacionHost() {
  const [pendiente, setPendiente] = useState<ConfirmacionPendiente | null>(null);

  useEffect(
    () =>
      registrarHostConfirmacion((pedido) =>
        setPendiente((anterior) => {
          // Una pregunta nueva reemplaza a la anterior, que queda cancelada.
          anterior?.responder(false);
          return pedido;
        }),
      ),
    [],
  );

  if (!pendiente) return null;
  const responder = (aceptada: boolean) => {
    pendiente.responder(aceptada);
    setPendiente(null);
  };

  return (
    <Modal titulo={pendiente.titulo} abierto onCerrar={() => responder(false)}>
      <p className="whitespace-pre-line break-words text-sm text-foreground">
        {pendiente.mensaje}
      </p>
      <div className="mt-5 flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={() => responder(false)}
          className="min-h-11 cursor-pointer rounded-lg border border-line px-4 text-sm font-semibold text-foreground hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          Cancelar
        </button>
        <button
          type="button"
          autoFocus
          onClick={() => responder(true)}
          className={`min-h-11 cursor-pointer rounded-lg px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 ${
            pendiente.peligro
              ? "bg-red-700 text-white hover:bg-red-800 dark:bg-red-300 dark:text-red-950 dark:hover:bg-red-200"
              : "bg-foreground text-background hover:opacity-90"
          }`}
        >
          {pendiente.textoConfirmar ?? "Confirmar"}
        </button>
      </div>
    </Modal>
  );
}
