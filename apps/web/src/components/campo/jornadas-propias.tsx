"use client";

import { Modal } from "@/components/modal";
import { formatoHora, textoRangoFechas } from "@/utils/fechas";
import { formatoDuracionMinutos } from "@/utils/duracion";
import { jornadasPorDia } from "@/utils/hoy-en-campo";
import type { AgendaCampo } from "@/types/campo";
import { IconoEntrada, IconoReloj, IconoSalida } from "./ui/iconos-campo";

/**
 * Presentismo de "Tu día": las visitas del período elegido, por día, con
 * entrada, salida y cuánto duró cada una. Las de llegada tarde van en amarillo.
 */
export function JornadasPropias({
  agenda,
  cuando,
  cerrar,
}: {
  agenda: AgendaCampo[];
  cuando: string;
  cerrar: () => void;
}) {
  const dias = jornadasPorDia(agenda);
  return (
    <Modal titulo="Tus jornadas" abierto hojaMovil ancho="lg" onCerrar={cerrar}>
      {dias.length ? (
        <div className="min-w-0 space-y-3">
          {dias.map((d) => {
            const total = d.visitas.reduce((s, v) => s + (v.minutos ?? 0), 0);
            return (
              <section
                key={d.fecha}
                aria-label={`Visitas del ${textoRangoFechas(d.fecha, d.fecha)}`}
                className="min-w-0 rounded-xl border border-line bg-surface-raised p-3"
              >
                <h3 className="mb-1.5 flex min-w-0 items-baseline justify-between gap-2 text-[11px] font-bold uppercase tracking-wide text-muted">
                  <span className="truncate">{textoRangoFechas(d.fecha, d.fecha)}</span>
                  <span className="shrink-0 font-semibold normal-case tracking-normal">
                    {d.visitas.length} {d.visitas.length === 1 ? "visita" : "visitas"}
                    {total ? ` · ${formatoDuracionMinutos(total)}` : ""}
                  </span>
                </h3>
                <ul className="min-w-0">
                  {d.visitas.map((v) => {
                    // Llegó tarde: se pinta para verlo de un vistazo.
                    const tarde = v.estadoPresentismo === "TARDE";
                    return (
                      <li
                        key={v.id}
                        className={
                          tarde
                            ? "-mx-1.5 my-1 rounded-lg border border-amber-300 bg-amber-50 px-1.5 py-2 dark:border-amber-800 dark:bg-amber-950/50"
                            : "border-t border-line py-2 first:border-t-0 first:pt-0 last:pb-0"
                        }
                      >
                        <p className="truncate text-sm font-semibold text-foreground">{v.local}</p>
                        <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted sm:text-xs">
                          <span className="inline-flex items-center gap-1">
                            <IconoEntrada className="h-3.5 w-3.5 shrink-0" />
                            Entrada <b className="font-mono text-foreground">{formatoHora(v.entrada)}</b>
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <IconoSalida className="h-3.5 w-3.5 shrink-0" />
                            Salida{" "}
                            <b className="font-mono text-foreground">
                              {v.salida ? formatoHora(v.salida) : "—"}
                            </b>
                          </span>
                          <span className="ml-auto inline-flex items-center gap-1 font-semibold text-foreground">
                            <IconoReloj className="h-3.5 w-3.5 shrink-0 text-muted" />
                            {v.minutos !== null
                              ? formatoDuracionMinutos(v.minutos)
                              : v.estado === "EN_CURSO"
                                ? "En curso"
                                : "Sin finalizar"}
                          </span>
                        </p>
                        {tarde ? (
                          <p className="mt-0.5 text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                            Llegó tarde
                          </p>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      ) : (
        <p className="py-8 text-center text-sm text-muted">No registraste visitas {cuando}.</p>
      )}
    </Modal>
  );
}
