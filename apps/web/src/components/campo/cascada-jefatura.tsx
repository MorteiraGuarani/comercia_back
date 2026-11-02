"use client";

import type { NodoDesempeno } from "@/utils/desempeno-jefatura";
import { personasRama } from "@/utils/desempeno-jefatura";
import { pct } from "@/utils/hoy-en-campo";
import { BarraSegmentos, RAYADO_EN_CURSO } from "./ui/barra-segmentos";
import { ORDEN_PRESENTISMO, PRESENTISMO_UI, enfoqueTablero } from "./ui/tablero-campo";

// Desempeño de Jefatura: el organigrama del jefe se recorre en cascada
// (supervisores → TeamLeaders → impulsadores y repositores).

/** Dónde está parado el jefe: toda la organización › supervisor › TeamLeader. */
export function MigasCascada({
  camino,
  onIr,
}: {
  camino: NodoDesempeno[];
  /** Cuántos niveles conservar: 0 vuelve a toda la organización. */
  onIr: (nivel: number) => void;
}) {
  if (!camino.length) return null;
  const pasos = [
    { id: 0, nombre: "Toda la organización" },
    ...camino.map((n) => ({ id: n.persona.id, nombre: n.persona.nombre })),
  ];
  return (
    <nav aria-label="Nivel del organigrama" className="min-w-0">
      <ol className="flex min-w-0 flex-wrap items-center gap-1 text-sm">
        {pasos.map((paso, nivel) => {
          const actual = nivel === pasos.length - 1;
          return (
            <li key={paso.id} className="flex min-w-0 items-center gap-1">
              {nivel ? (
                <span aria-hidden="true" className="text-muted">
                  ›
                </span>
              ) : null}
              {actual ? (
                <span aria-current="page" className="truncate font-semibold text-foreground">
                  {paso.nombre}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onIr(nivel)}
                  className={`min-h-11 cursor-pointer truncate rounded-md px-1.5 text-brand-700 underline-offset-2 hover:underline dark:text-brand-200 ${enfoqueTablero}`}
                >
                  {paso.nombre}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Quienes tienen gente a cargo: una tarjeta con los números de su rama. */
export function GruposCascada({
  nodos,
  metric,
  onAbrir,
}: {
  nodos: NodoDesempeno[];
  metric: "presentismo" | "ruta" | "tareas";
  onAbrir: (nodo: NodoDesempeno) => void;
}) {
  if (!nodos.length) return null;
  return (
    <section aria-label="Equipos a cargo" className="min-w-0 space-y-2">
      <h2 className="text-xs font-bold uppercase tracking-wide text-muted">
        Equipos a cargo · {nodos.length}
      </h2>
      <ul className="grid min-w-0 grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
        {nodos.map((nodo) => {
          const rama = personasRama(nodo);
          const estados = Object.fromEntries(
            ORDEN_PRESENTISMO.map((e) => [e, rama.filter((c) => c.estadoPresentismo === e).length]),
          ) as Record<(typeof ORDEN_PRESENTISMO)[number], number>;
          const enCampo = estados.PRESENTE + estados.EN_CURSO + estados.INCOMPLETO;
          const suma = (valor: (c: (typeof rama)[number]) => number) =>
            rama.reduce((s, c) => s + valor(c), 0);
          const ruta = {
            total: suma((c) => c.ruta.total),
            completadas: suma((c) => c.ruta.completadas),
            enCurso: suma((c) => c.ruta.enCurso),
            incompletas: suma((c) => c.ruta.incompletas),
            ausentes: suma((c) => c.ruta.ausentes),
          };
          const tareas = {
            total: suma((c) => c.tareas.total),
            completadas: suma((c) => c.tareas.completadas),
            obligatorias: suma((c) => c.tareas.obligPendientes),
          };
          const dato =
            metric === "ruta"
              ? {
                  valor: pct(ruta.completadas, ruta.total),
                  nota: `${ruta.completadas}/${ruta.total} visitas`,
                  barra: (
                    <BarraSegmentos
                      total={ruta.total}
                      segmentos={[
                        { valor: ruta.completadas, clase: "bg-emerald-600 dark:bg-emerald-500", etiqueta: "visitados" },
                        { valor: ruta.enCurso, clase: RAYADO_EN_CURSO, etiqueta: "en curso" },
                        { valor: ruta.incompletas, clase: "bg-orange-500 dark:bg-orange-400", etiqueta: "sin salida" },
                        { valor: ruta.ausentes, clase: "bg-red-600 dark:bg-red-500", etiqueta: "sin visitar" },
                      ]}
                    />
                  ),
                }
              : metric === "tareas"
                ? {
                    valor: pct(tareas.completadas, tareas.total),
                    nota: `${tareas.completadas}/${tareas.total} tareas${tareas.obligatorias ? ` · ${tareas.obligatorias} obligatorias pendientes` : ""}`,
                    barra: (
                      <BarraSegmentos
                        total={tareas.total}
                        segmentos={[{ valor: tareas.completadas, clase: "bg-brand-600 dark:bg-brand-500", etiqueta: "hechas" }]}
                      />
                    ),
                  }
                : {
                    valor: pct(enCampo, rama.length),
                    nota: `${enCampo} de ${rama.length} en campo${estados.AUSENTE ? ` · ${estados.AUSENTE} ausente${estados.AUSENTE > 1 ? "s" : ""}` : ""}`,
                    barra: (
                      <BarraSegmentos
                        total={rama.length}
                        segmentos={ORDEN_PRESENTISMO.map((e) => ({
                          valor: estados[e],
                          clase: PRESENTISMO_UI[e].barra,
                          etiqueta: PRESENTISMO_UI[e].etiqueta.toLowerCase(),
                        }))}
                      />
                    ),
                  };
          return (
            <li key={nodo.persona.id} className="min-w-0">
              <button
                type="button"
                onClick={() => onAbrir(nodo)}
                aria-label={`Ver el equipo de ${nodo.persona.nombre}`}
                className={`flex min-h-11 w-full min-w-0 cursor-pointer flex-col gap-2 rounded-xl border border-line bg-surface-raised p-3 text-left transition-colors hover:border-brand-500 hover:bg-surface-soft/40 sm:p-4 ${enfoqueTablero}`}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden="true"
                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 bg-surface-soft text-sm font-bold text-foreground ${PRESENTISMO_UI[nodo.persona.estadoPresentismo].anillo}`}
                  >
                    {nodo.persona.iniciales}
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-sm text-foreground">{nodo.persona.nombre}</strong>
                    <span className="block truncate text-xs text-muted">
                      {nodo.persona.zona} · {rama.length - 1} a cargo
                    </span>
                  </span>
                  <span className="ft-display shrink-0 text-2xl font-bold tabular-nums text-foreground">
                    {dato.valor}
                    <small className="text-sm font-semibold text-muted">%</small>
                  </span>
                  <span aria-hidden="true" className="shrink-0 text-lg text-muted">
                    ›
                  </span>
                </span>
                {dato.barra}
                <span className="truncate text-xs text-muted">{dato.nota}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
