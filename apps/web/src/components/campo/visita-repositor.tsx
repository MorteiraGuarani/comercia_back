"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { formatoHora } from "@/utils/fechas";
import { RUTA } from "@/utils/estado-jornada";
import { tareaCumplidaEnVisita } from "@/utils/tareas-campo";
import type {
  AgendaCampo,
  TareaJornadaCampo,
  VisitaCampo,
} from "@/types/campo";
import type { RespuestaPaginada } from "@/types/paginacion";
import { FotoLocal } from "./ui/foto-local";
import { RUTA_PILL } from "./ui/tablero-campo";
import {
  IconoAlerta,
  IconoCaja,
  IconoCamara,
  IconoCandado,
  IconoCheck,
  IconoChevronAbajo,
  IconoFlechaIzq,
  IconoMapa,
  IconoMensaje,
  IconoPin,
  IconoPlay,
  IconoReloj,
  IconoSalida,
} from "./ui/iconos-campo";

// "Mis tareas" del repositor (mockup "Vista de local – en curso" y "Tareas de
// la visita"). Con visita abierta: el local, el avance y sus tareas para
// trabajarlas. Sin visita: las tareas de cada local para leerlas; empezar y
// completar requieren marcar entrada.

const enfoque =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus";
const btnAccion = `flex min-h-11 min-w-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-line bg-surface-raised px-3 text-xs font-semibold text-foreground transition-colors hover:border-brand-500 hover:bg-surface-soft disabled:cursor-not-allowed disabled:opacity-50 ${enfoque}`;
const sombra = "shadow-[0_2px_8px_rgba(var(--warm-shadow),0.06)]";

interface AccionesTarea {
  ocupadoId: number | null;
  onIniciar: (tareaId: number) => void;
  onCompletar: (tareaId: number) => void;
  onFotos: (tarea: TareaJornadaCampo) => void;
  onComentarios: (tarea: TareaJornadaCampo) => void;
  onNovedad: (tarea: TareaJornadaCampo) => void;
}

interface VisitaRepositorProps extends AccionesTarea {
  /** Local de la visita abierta de hoy (null si no hay visita). */
  agenda: AgendaCampo | null;
  visita: VisitaCampo | null;
  tareas: RespuestaPaginada<TareaJornadaCampo> | null;
  /** Locales del día y sus tareas, para leerlas sin visita abierta. */
  agendas: AgendaCampo[];
  tareasPorLocal: Record<number, RespuestaPaginada<TareaJornadaCampo>>;
  cargando: boolean;
  rutaMiRuta: string;
  rutaInventario: string | null;
  onMapa: (agenda: AgendaCampo) => void;
  /** Paginación, solo si la visita tiene más tareas de las que entran. */
  paginacion?: ReactNode;
}

export function VisitaRepositor({
  agenda,
  visita,
  tareas,
  agendas,
  tareasPorLocal,
  cargando,
  rutaMiRuta,
  rutaInventario,
  onMapa,
  paginacion,
  ...acciones
}: VisitaRepositorProps) {
  if (cargando && !agendas.length)
    return (
      <p role="status" className="py-12 text-center text-sm text-muted">
        Cargando tus tareas…
      </p>
    );

  if (!visita || !agenda)
    return (
      <TareasSinVisita
        agendas={agendas}
        tareasPorLocal={tareasPorLocal}
        cargando={cargando}
        rutaMiRuta={rutaMiRuta}
      />
    );

  const lista = tareas?.items ?? [];
  const hechas = lista.filter((t) => tareaCumplidaEnVisita(t, visita.id)).length;
  const total = tareas?.total ?? 0;
  const avance = total ? Math.round((hechas / total) * 100) : 0;
  const faltan = Math.max(0, total - hechas);

  return (
    <div className="mx-auto w-full min-w-0 max-w-2xl space-y-3 sm:space-y-4">
      {/* Barra de la visita: volver, nombre y mapa */}
      <div className="flex min-w-0 items-center gap-2">
        <Link
          href={rutaMiRuta}
          aria-label="Volver a Mi Ruta"
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg text-foreground hover:bg-surface-soft ${enfoque}`}
        >
          <IconoFlechaIzq className="h-5 w-5" />
        </Link>
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{agenda.local.nombre}</p>
        <button type="button" onClick={() => onMapa(agenda)} className={`${btnAccion} shrink-0`}>
          <IconoMapa className="h-4 w-4" />
          Mapa
        </button>
      </div>

      {/* Tarjeta del local */}
      <section
        aria-label="Visita en curso"
        className={`rounded-2xl border border-sky-500/50 bg-surface-raised p-4 ${sombra} ring-2 ring-sky-500/15 dark:border-sky-700 dark:ring-sky-400/15`}
      >
        <div className="flex min-w-0 gap-3">
          <FotoLocal
            nombre={agenda.local.nombre}
            className="w-24 shrink-0 self-start sm:w-32"
          />
          <div className="min-w-0 flex-1">
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-600 px-2.5 py-0.5 text-[11px] font-bold text-white dark:bg-sky-500 dark:text-sky-950">
              <IconoPlay className="h-2.5 w-2.5" />
              En curso
            </span>
            <h1 className="mt-1 truncate text-lg font-bold leading-tight text-foreground sm:text-xl">
              {agenda.local.nombre}
            </h1>
            <p className="truncate font-mono text-xs font-semibold text-brand-700 dark:text-brand-200">{agenda.local.id}</p>
            <p className="mt-1 flex min-w-0 items-start gap-1 text-xs text-muted">
              <IconoPin className="mt-px h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 break-words">{agenda.local.direccion || "Sin dirección cargada"}</span>
            </p>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
              <IconoReloj className="h-3.5 w-3.5 shrink-0" />
              En el local desde <b className="font-mono text-foreground">{formatoHora(visita.entrada)}</b>
            </p>
          </div>
        </div>

        <div className="mt-4 border-t border-line pt-3">
          <p className="text-xs font-semibold text-foreground">Progreso de tareas</p>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={avance}
            aria-label="Progreso de tareas"
            className="mt-2 h-2 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-700"
          >
            <div
              className={`h-full rounded-full transition-[width] ${avance === 100 ? "bg-emerald-600 dark:bg-emerald-500" : "bg-sky-600 dark:bg-sky-500"}`}
              style={{ width: `${avance}%` }}
            />
          </div>
          <p className="mt-1.5 flex justify-between text-xs text-muted">
            <span>
              {hechas} de {total} completadas
            </span>
            <b className="tabular-nums text-foreground">{avance}%</b>
          </p>
        </div>

        {rutaInventario ? (
          <Link
            href={`${rutaInventario}?local=${encodeURIComponent(agenda.local.id)}`}
            className={`${btnAccion} mt-3 w-full`}
          >
            <IconoCaja className="h-4 w-4" />
            Inventario
          </Link>
        ) : null}
      </section>

      {/* Tareas de la visita */}
      <section aria-labelledby="titulo-tareas-visita" className="space-y-2">
        <div className="flex items-center justify-between gap-2 px-0.5">
          <h2 id="titulo-tareas-visita" className="text-sm font-bold text-foreground">
            Tareas de la visita
          </h2>
          <span className="rounded-full bg-surface-soft px-2 py-0.5 text-xs font-bold tabular-nums text-foreground">
            {hechas}/{total}
          </span>
        </div>

        {cargando && !lista.length ? (
          <p role="status" className="py-6 text-center text-sm text-muted">Cargando tareas…</p>
        ) : !lista.length ? (
          <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">
            Este local no tiene tareas asignadas para hoy.
          </p>
        ) : (
          <ListaTareas tareas={lista} visitaId={visita.id} acciones={acciones} />
        )}
        {paginacion}
      </section>

      {/* Cierre de la visita: la salida se marca en Mi Ruta con UCheck */}
      <div className="space-y-1.5 pt-1">
        <p className={`text-center text-xs ${faltan ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"}`}>
          {total === 0
            ? "Sin tareas para esta visita."
            : faltan
              ? `Te ${faltan === 1 ? "falta 1 tarea" : `faltan ${faltan} tareas`} por completar.`
              : "¡Completaste todas las tareas de la visita!"}
        </p>
        <Link
          href={rutaMiRuta}
          className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 text-sm font-bold text-white shadow-sm hover:bg-brand-800 dark:bg-brand-500 dark:text-brand-950 dark:hover:brightness-110 ${enfoque}`}
        >
          <IconoSalida className="h-4 w-4" />
          Finalizar visita
        </Link>
        <p className="text-center text-[11px] text-muted">
          Te lleva a Mi Ruta para marcar la salida con UCheck activo.
        </p>
      </div>
    </div>
  );
}

/** Sin visita abierta: las tareas de cada local del día, solo para leer. */
function TareasSinVisita({
  agendas,
  tareasPorLocal,
  cargando,
  rutaMiRuta,
}: {
  agendas: AgendaCampo[];
  tareasPorLocal: Record<number, RespuestaPaginada<TareaJornadaCampo>>;
  cargando: boolean;
  rutaMiRuta: string;
}) {
  return (
    <div className="mx-auto w-full min-w-0 max-w-2xl space-y-3 sm:space-y-4">
      <section className="flex min-w-0 items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40">
        <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-500 text-white dark:bg-amber-400 dark:text-amber-950">
          <IconoCandado className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-bold text-foreground">Todavía no marcaste entrada</h1>
          <p className="mt-0.5 text-sm text-amber-900 dark:text-amber-100">
            Podés revisar las tareas de tus locales. Para empezarlas o completarlas, marcá entrada en el local desde Mi Ruta.
          </p>
          <Link
            href={rutaMiRuta}
            className={`mt-3 inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800 dark:bg-brand-500 dark:text-brand-950 dark:hover:brightness-110 ${enfoque}`}
          >
            Ir a Mi Ruta
          </Link>
        </div>
      </section>

      {!agendas.length ? (
        <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">
          No tenés locales asignados para hoy.
        </p>
      ) : (
        agendas.map((ag, i) => {
          const datos = tareasPorLocal[ag.id];
          const lista = datos?.items ?? [];
          const hechas = lista.filter((t) => tareaCumplidaEnVisita(t)).length;
          return (
            <details
              key={ag.id}
              open={i === 0}
              className={`group/local min-w-0 overflow-hidden rounded-2xl border border-line bg-surface-raised ${sombra}`}
            >
              <summary
                className={`flex min-h-14 cursor-pointer list-none items-center gap-3 px-3 py-2.5 transition-colors hover:bg-surface-soft/50 [&::-webkit-details-marker]:hidden ${enfoque} focus-visible:ring-inset`}
              >
                <FotoLocal nombre={ag.local.nombre} className="w-14 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-foreground">{ag.local.nombre}</span>
                  <span className="block truncate text-[11px] text-muted">
                    {datos
                      ? `${datos.total} ${datos.total === 1 ? "tarea" : "tareas"}${hechas ? ` · ${hechas} hechas hoy` : ""}`
                      : cargando
                        ? "Cargando tareas…"
                        : "Sin tareas cargadas"}
                  </span>
                </span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${RUTA_PILL[ag.estado]}`}>
                  {RUTA[ag.estado].etiqueta}
                </span>
                <IconoChevronAbajo className="h-4 w-4 shrink-0 text-muted motion-safe:transition-transform group-open/local:rotate-180" />
              </summary>
              <div className="border-t border-line">
                {lista.length ? (
                  <ListaTareas tareas={lista} soloLectura enmarcada={false} />
                ) : (
                  <p className="p-4 text-center text-sm text-muted">
                    {cargando ? "Cargando tareas…" : "Este local no tiene tareas asignadas para hoy."}
                  </p>
                )}
              </div>
            </details>
          );
        })
      )}
    </div>
  );
}

/**
 * Lista de tareas con el estado de cada una. En modo lectura muestra la
 * instrucción y avisa que hay que marcar entrada; con visita, las acciones.
 */
function ListaTareas({
  tareas,
  visitaId,
  acciones,
  soloLectura = false,
  enmarcada = true,
}: {
  tareas: TareaJornadaCampo[];
  visitaId?: number;
  acciones?: AccionesTarea;
  soloLectura?: boolean;
  enmarcada?: boolean;
}) {
  const hecha = (t: TareaJornadaCampo) => tareaCumplidaEnVisita(t, visitaId);
  // Se abre sola la primera tarea pendiente hasta que el usuario elige otra.
  const [elegida, setElegida] = useState<number | null | undefined>();
  const abierta =
    elegida === undefined
      ? soloLectura
        ? null
        : (tareas.find((t) => !hecha(t))?.id ?? null)
      : elegida;

  return (
    <ul className={enmarcada ? `overflow-hidden rounded-2xl border border-line bg-surface-raised ${sombra}` : ""}>
      {tareas.map((t) => {
        const cumplida = hecha(t);
        const enCurso = !soloLectura && !cumplida && !!t.iniciadaAt;
        const abiertaFila = abierta === t.id;
        const idDetalle = `tarea-${soloLectura ? "lectura" : "visita"}-${t.id}`;
        return (
          <li key={t.id} className="border-t border-line first:border-t-0">
            <button
              type="button"
              onClick={() => setElegida(abiertaFila ? null : t.id)}
              aria-expanded={abiertaFila}
              aria-controls={idDetalle}
              className={`flex min-h-14 w-full min-w-0 cursor-pointer items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-surface-soft/60 ${enfoque} focus-visible:ring-inset`}
            >
              <span
                aria-hidden="true"
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 ${
                  cumplida
                    ? "border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500 dark:text-emerald-950"
                    : enCurso
                      ? "border-sky-500 text-sky-600 dark:border-sky-400 dark:text-sky-300"
                      : "border-stone-300 dark:border-stone-600"
                }`}
              >
                {cumplida ? <IconoCheck className="h-4 w-4" /> : enCurso ? <IconoPlay className="h-2.5 w-2.5" /> : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-[13px] font-semibold sm:text-sm ${cumplida ? "text-muted line-through" : "text-foreground"}`}>
                  {t.nombre}
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px]">
                  <span
                    className={
                      cumplida
                        ? "font-semibold text-emerald-700 dark:text-emerald-300"
                        : enCurso
                          ? "font-semibold text-sky-700 dark:text-sky-300"
                          : "text-muted"
                    }
                  >
                    {cumplida ? (soloLectura ? "Hecha hoy" : "Completada") : enCurso ? "En curso" : "Pendiente"}
                  </span>
                  {t.esObligatoria ? <span className="font-semibold text-red-700 dark:text-red-300">Obligatoria</span> : null}
                  {t.fotosObligatorias ? <span className="font-semibold text-amber-700 dark:text-amber-300">Fotos obligatorias</span> : null}
                </span>
              </span>
              <IconoChevronAbajo
                className={`h-4 w-4 shrink-0 text-muted motion-safe:transition-transform ${abiertaFila ? "rotate-180" : ""}`}
              />
            </button>

            {abiertaFila ? (
              <div id={idDetalle} className="space-y-2.5 px-3 pb-3 pl-[3.25rem]">
                <p className="break-words text-xs leading-relaxed text-muted">
                  {t.descripcion?.trim() || "Sin instrucciones adicionales."}
                </p>
                {soloLectura || !acciones ? (
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                    <IconoCandado className="h-3.5 w-3.5 shrink-0" />
                    Marcá entrada en este local para empezarla.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {!cumplida && !t.iniciadaAt ? (
                      <button
                        type="button"
                        disabled={acciones.ocupadoId !== null}
                        onClick={() => acciones.onIniciar(t.id)}
                        className={btnAccion}
                      >
                        <IconoPlay className="h-3 w-3" />
                        Empezar
                      </button>
                    ) : null}
                    {!cumplida ? (
                      <button
                        type="button"
                        disabled={acciones.ocupadoId !== null}
                        onClick={() => acciones.onCompletar(t.id)}
                        className={`flex min-h-11 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-emerald-700 px-3 text-xs font-bold text-white transition-colors hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-50 dark:bg-emerald-600 dark:hover:bg-emerald-500 ${enfoque}`}
                      >
                        <IconoCheck className="h-3.5 w-3.5" />
                        {acciones.ocupadoId === t.id ? "Guardando…" : "Completar"}
                      </button>
                    ) : null}
                    {t.requiereFotos ? (
                      <button type="button" onClick={() => acciones.onFotos(t)} className={btnAccion}>
                        <IconoCamara className="h-3.5 w-3.5" />
                        Fotos
                      </button>
                    ) : null}
                    <button type="button" onClick={() => acciones.onComentarios(t)} className={btnAccion}>
                      <IconoMensaje className="h-3.5 w-3.5" />
                      Comentarios
                    </button>
                    <button type="button" onClick={() => acciones.onNovedad(t)} className={btnAccion}>
                      <IconoAlerta className="h-3.5 w-3.5" />
                      Novedad
                    </button>
                  </div>
                )}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
