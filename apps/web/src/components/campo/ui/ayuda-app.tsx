"use client";

import { useState } from "react";
import { Modal } from "@/components/modal";
import { IconoInfo } from "./iconos-campo";
import { ORDEN_PRESENTISMO, PRESENTISMO_UI } from "./tablero-campo";
import type { EstadoPresentismo } from "@/types/estado-jornada";

// Mismas reglas que evaluarPresentismo en la API.
const QUE_SIGNIFICA: Record<EstadoPresentismo, string> = {
  PRESENTE: "Inició y finalizó la visita: marcó entrada y salida.",
  EN_CURSO: "Inició la visita y todavía no la finalizó, dentro de su horario.",
  INCOMPLETO:
    "Le falta una marca: inició y no finalizó cuando terminó el horario, o hay salida sin entrada.",
  AUSENTE: "Terminó el horario y no inició la visita.",
  SIN_REGISTRO: "Todavía no hay marcas y el horario no terminó.",
};

const AVISOS = [
  {
    color: "bg-emerald-600 dark:bg-emerald-500",
    texto: "Verde: se guardó bien.",
  },
  {
    color: "bg-amber-500 dark:bg-amber-400",
    texto:
      "Amarillo: quedó pendiente (por ejemplo, sin señal) o falta algo de tu parte.",
  },
  {
    color: "bg-red-600 dark:bg-red-500",
    texto: "Rojo: no se pudo hacer; el aviso dice el motivo.",
  },
];

const BASICO = [
  "Tocá un indicador (KPI) para filtrar la lista por ese estado; tocalo otra vez para ver todo.",
  "Iniciar y Finalizar visita se marcan en el local, dentro del radio permitido (200 m si el local no tiene otro).",
  "Las tareas se finalizan con la visita iniciada. «Obligatoria» es parte de la visita; algunas piden foto de antes y después. El tilde verde indica que está terminada.",
  "Novedad: avisale a tu supervisor de un problema en el local; se habilita con la visita iniciada.",
  "Sin señal, lo que hagas queda guardado en el teléfono y se envía solo cuando vuelve la conexión.",
  "Los botones en rojo claro (Finalizar) cierran algo: la visita, una tarea o una novedad.",
];

/** "i" del saludo: explica estados, colores y lo básico de la app, para todos los roles. */
export function AyudaApp() {
  const [abierta, setAbierta] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setAbierta(true)}
        aria-label="Información: estados y colores de la app"
        title="Información"
        className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full border border-brand-200 bg-surface-raised text-brand-800 shadow-sm transition-colors hover:bg-brand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus dark:border-brand-800 dark:text-brand-100 dark:hover:bg-brand-900"
      >
        <IconoInfo className="h-5 w-5" />
      </button>
      {abierta ? (
        <Modal
          titulo="Cómo leer la app"
          abierto
          onCerrar={() => setAbierta(false)}
          textoCerrar="Entendido"
          ancho="md"
          hojaMovil
        >
          <div className="min-w-0 space-y-5 text-sm text-foreground">
            <section aria-labelledby="ayuda-estados" className="space-y-2">
              <h3 id="ayuda-estados" className="font-bold">
                Estados de visitas y presentismo
              </h3>
              <p className="text-xs text-muted">
                Son los mismos en Inicio, Itinerario y Desempeño, para todos
                los roles.
              </p>
              <ul className="space-y-2">
                {ORDEN_PRESENTISMO.map((estado) => (
                  <li key={estado} className="flex min-w-0 items-start gap-2.5">
                    <span
                      className={`mt-0.5 inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-bold ${PRESENTISMO_UI[estado].pill}`}
                    >
                      <span
                        aria-hidden="true"
                        className={`h-2 w-2 rounded-full ${PRESENTISMO_UI[estado].barra}`}
                      />
                      {PRESENTISMO_UI[estado].etiqueta}
                    </span>
                    <span className="min-w-0 text-muted">
                      {QUE_SIGNIFICA[estado]}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
            <section aria-labelledby="ayuda-avisos" className="space-y-2">
              <h3 id="ayuda-avisos" className="font-bold">
                Colores de los avisos
              </h3>
              <ul className="space-y-1.5">
                {AVISOS.map((a) => (
                  <li key={a.texto} className="flex items-start gap-2.5">
                    <span
                      aria-hidden="true"
                      className={`mt-1 h-3 w-3 shrink-0 rounded-full ${a.color}`}
                    />
                    <span className="text-muted">{a.texto}</span>
                  </li>
                ))}
              </ul>
            </section>
            <section aria-labelledby="ayuda-basico" className="space-y-2">
              <h3 id="ayuda-basico" className="font-bold">
                Lo básico
              </h3>
              <ul className="list-disc space-y-1.5 pl-5 text-muted">
                {BASICO.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </section>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
