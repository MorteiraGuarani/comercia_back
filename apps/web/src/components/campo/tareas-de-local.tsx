"use client";
import { useState } from "react";
import { IconoCamara, IconoCheck, IconoMensaje } from "./ui/iconos-campo";
import { enviarAccionTarea } from "@/lib/pendientes-tareas";
import { useListaCampo, useOperacionCampo } from "@/hooks/use-lista-campo";
import { usePanel } from "@/components/panel/contexto";
import { Modal } from "@/components/modal";
import { PantallaCarga } from "@/components/pantalla-carga";
import { mostrarToast } from "@/components/toast/toast-controller";
import { errorBox } from "@/components/ui";
import { TablaCampo } from "./tabla-campo";
import { SubidorFotos } from "./subidor-fotos";
import { PanelComentarios } from "./panel-comentarios";
import type { AgendaCampo, TareaJornadaCampo, VisitaCampo } from "@/types/campo";

const btnTarea =
  "inline-flex min-h-11 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-line bg-surface-raised px-3 text-xs font-semibold text-foreground transition-colors hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50";
const btnTerminar =
  "inline-flex min-h-11 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg bg-emerald-700 px-3 text-xs font-bold text-white transition-colors hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-700 dark:hover:bg-emerald-800";

/**
 * Tareas de un local de la ruta: todo lo de la visita se hace acá (fotos,
 * comentarios y terminar la tarea). Se leen siempre; se hacen con la visita iniciada.
 */
export function TareasDeLocal({
  agenda,
  qsFecha,
  abierta,
  cerrar,
}: {
  agenda: AgendaCampo;
  qsFecha: string;
  abierta: VisitaCampo | null;
  cerrar: () => void;
}) {
  const { usuario } = usePanel();
  const lista = useListaCampo<TareaJornadaCampo>(
    `/campo/jornada/asignaciones/${agenda.id}/tareas?${qsFecha}`,
  );
  const op = useOperacionCampo();
  const [fotos, setFotos] = useState<TareaJornadaCampo | null>(null);
  const [comentarios, setComentarios] = useState<TareaJornadaCampo | null>(null);
  const visita = abierta?.asignacionId === agenda.id ? abierta : null;
  const hecha = (t: TareaJornadaCampo) =>
    visita
      ? t.visitasCompletadas.includes(visita.id)
      : t.visitasCompletadas.length > 0;

  // Misma cola que usaba Mis tareas: sin señal queda guardado y se envía después.
  function terminar(t: TareaJornadaCampo) {
    if (!visita) return;
    void op.ejecutar("Terminando tarea", async () => {
      const r = await enviarAccionTarea(
        usuario.id,
        `/campo/jornada/visitas/${visita.id}/tareas/${t.id}`,
        "Terminar tarea",
      );
      if (r.pendiente)
        mostrarToast(
          "alerta",
          "Guardado en el dispositivo: la tarea se confirma cuando vuelva la conexión.",
        );
      lista.refrescar();
    });
  }

  const acciones = (t: TareaJornadaCampo) =>
    visita ? (
      <div className="flex flex-wrap gap-1.5">
        {t.requiereFotos ? (
          <button type="button" className={btnTarea} onClick={() => setFotos(t)}>
            <IconoCamara className="h-3.5 w-3.5" />
            Fotos
          </button>
        ) : null}
        <button type="button" className={btnTarea} onClick={() => setComentarios(t)}>
          <IconoMensaje className="h-3.5 w-3.5" />
          Comentarios
        </button>
        {hecha(t) ? (
          <span className="inline-flex min-h-11 items-center gap-1 px-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            <IconoCheck className="h-3.5 w-3.5" />
            Terminada
          </span>
        ) : (
          <button
            type="button"
            className={btnTerminar}
            disabled={!!op.mensaje}
            onClick={() => terminar(t)}
            aria-label={`Terminar ${t.nombre}`}
          >
            Terminar Tarea
          </button>
        )}
      </div>
    ) : null;

  return (
    <Modal
      titulo={`Tareas · ${agenda.local.nombre}`}
      abierto
      onCerrar={cerrar}
      ancho="lg"
      hojaMovil
    >
      <p className="mb-3 text-xs text-muted sm:mb-4 sm:text-sm">
        {visita
          ? "Cargá las fotos que pida cada tarea, dejá comentarios y terminala."
          : "Podés revisar las tareas. Para hacerlas, iniciá la visita en este local."}
      </p>
      <TablaCampo
        lista={lista}
        etiqueta="Tareas del local"
        columnas={[
          {
            titulo: "Tarea",
            valor: (t) => (
              <div className="min-w-0">
                <p className="font-semibold text-foreground">{t.nombre}</p>
                {t.descripcion ? <p className="text-xs text-muted">{t.descripcion}</p> : null}
              </div>
            ),
          },
          {
            titulo: "Estado",
            valor: (t) =>
              visita
                ? hecha(t)
                  ? "Terminada"
                  : "Pendiente"
                : `${t.visitasCompletadas.length} realizadas hoy`,
          },
        ]}
        tarjetaMovil={(t) => (
          <div className="min-w-0 space-y-2 rounded-xl border border-line bg-surface-raised px-3 py-2.5">
            <div className="flex min-w-0 items-start gap-3">
              {/* Tilde solo al terminarla: un cuadro vacío parecía un checkbox que no hacía nada. */}
              {hecha(t) ? (
                <span
                  aria-hidden="true"
                  className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-600 text-white motion-safe:animate-aparecer dark:bg-emerald-500 dark:text-emerald-950"
                >
                  <IconoCheck className="h-3.5 w-3.5" />
                </span>
              ) : null}
              <div className="min-w-0 flex-1">
                <p
                  className={`text-[13px] font-semibold leading-snug ${hecha(t) ? "text-muted line-through" : "text-foreground"}`}
                >
                  {t.nombre}
                </p>
                {t.descripcion ? (
                  <p className="line-clamp-2 text-[11px] text-muted">{t.descripcion}</p>
                ) : null}
                {!visita || t.esObligatoria || t.requiereFotos ? (
                  <p className="mt-0.5 flex flex-wrap gap-x-2 text-[10px] font-semibold uppercase tracking-wide text-muted">
                    {t.esObligatoria ? (
                      <span className="text-amber-700 dark:text-amber-300">Obligatoria</span>
                    ) : null}
                    {t.requiereFotos ? (
                      <span>{t.fotosObligatorias ? "Fotos obligatorias" : "Con foto"}</span>
                    ) : null}
                    {!visita ? <span>{t.visitasCompletadas.length} realizadas hoy</span> : null}
                  </p>
                ) : null}
              </div>
            </div>
            {acciones(t)}
          </div>
        )}
        acciones={acciones}
      />
      {op.error ? <p className={errorBox}>{op.error}</p> : null}
      <PantallaCarga visible={!!op.mensaje} mensaje={op.mensaje} />

      {fotos && visita ? (
        <Modal titulo={`Fotos · ${fotos.nombre}`} abierto onCerrar={() => setFotos(null)} ancho="md">
          <SubidorFotos
            key={`${visita.id}-${fotos.id}`}
            visitaId={visita.id}
            tareaId={fotos.id}
            obligatorio={fotos.fotosObligatorias}
            onFotosActualizadas={lista.refrescar}
          />
        </Modal>
      ) : null}
      {comentarios && visita ? (
        <Modal
          titulo={`Comentarios · ${comentarios.nombre}`}
          abierto
          onCerrar={() => setComentarios(null)}
          ancho="md"
        >
          <PanelComentarios visitaId={visita.id} tareaId={comentarios.id} />
        </Modal>
      ) : null}
    </Modal>
  );
}
