"use client";
import { IconoCheck } from "./ui/iconos-campo";
import { apiFetch } from "@/lib/api";
import { useListaCampo, useOperacionCampo } from "@/hooks/use-lista-campo";
import { Modal } from "@/components/modal";
import { PantallaCarga } from "@/components/pantalla-carga";
import { btnPrimary, errorBox } from "@/components/ui";
import { TablaCampo } from "./tabla-campo";
import type { AgendaCampo, TareaJornadaCampo, VisitaCampo } from "@/types/campo";

// Tareas de un local de la ruta: se pueden leer siempre y ejecutar con la entrada marcada.

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
  const lista = useListaCampo<TareaJornadaCampo>(
    `/campo/jornada/asignaciones/${agenda.id}/tareas?${qsFecha}`,
  );
  const op = useOperacionCampo();
  const visita = abierta?.asignacionId === agenda.id ? abierta : null;
  const hecha = (t: TareaJornadaCampo) =>
    visita
      ? t.visitasCompletadas.includes(visita.id)
      : t.visitasCompletadas.length > 0;
  function completar(t: TareaJornadaCampo) {
    if (!visita) return;
    void op.ejecutar("Completando tarea", async () => {
      await apiFetch(`/campo/jornada/visitas/${visita.id}/tareas/${t.id}`, {
        method: "POST",
      });
      lista.refrescar();
    });
  }
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
          ? "Marcá las tareas realizadas en esta visita."
          : "Podés revisar las tareas. Para completarlas, marcá entrada en este local."}
      </p>
      <TablaCampo
        lista={lista}
        etiqueta="Tareas del local"
        columnas={[
          { titulo: "Tarea", valor: (t) => t.nombre },
          { titulo: "Descripción", valor: (t) => t.descripcion },
          {
            titulo: "Estado",
            valor: (t) =>
              visita
                ? hecha(t)
                  ? "Completada"
                  : "Pendiente"
                : `${t.visitasCompletadas.length} realizadas hoy`,
          },
        ]}
        tarjetaMovil={(t) => (
          <div className="flex min-w-0 items-center gap-3 rounded-xl border border-line bg-surface-raised px-3 py-2.5">
            <span
              aria-hidden="true"
              className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 ${
                hecha(t)
                  ? "border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500 dark:text-emerald-950"
                  : "border-line bg-surface-raised"
              }`}
            >
              {hecha(t) ? <IconoCheck className="h-3.5 w-3.5" /> : null}
            </span>
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
                  {t.esObligatoria ? <span className="text-amber-700 dark:text-amber-300">Obligatoria</span> : null}
                  {t.requiereFotos ? <span>Con foto</span> : null}
                  {!visita ? <span>{t.visitasCompletadas.length} realizadas hoy</span> : null}
                </p>
              ) : null}
            </div>
            {visita && !hecha(t) ? (
              <button
                type="button"
                onClick={() => completar(t)}
                disabled={!!op.mensaje}
                aria-label={`Completar ${t.nombre}`}
                className="min-h-11 shrink-0 cursor-pointer whitespace-nowrap rounded-lg bg-brand-700 px-3 text-xs font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50 dark:bg-brand-500 dark:text-brand-950 dark:hover:brightness-110"
              >
                Completar
              </button>
            ) : null}
          </div>
        )}
        acciones={(t) =>
          visita ? (
            <button
              className={btnPrimary}
              disabled={hecha(t) || !!op.mensaje}
              onClick={() => completar(t)}
            >
              Completar
            </button>
          ) : null
        }
      />
      {op.error ? <p className={errorBox}>{op.error}</p> : null}
      <PantallaCarga visible={!!op.mensaje} mensaje={op.mensaje} />
    </Modal>
  );
}
