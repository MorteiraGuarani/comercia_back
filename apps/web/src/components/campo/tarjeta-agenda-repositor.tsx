"use client";
import { colorFinalizar } from "@/components/ui";
import { RUTA } from "@/utils/estado-jornada";
import { formatoFechaCalendario, formatoHora } from "@/utils/fechas";
import { formatoDuracionMinutos } from "@/utils/duracion";
import { useResumenTareasLocal } from "@/hooks/use-resumen-tareas-local";
import type { EstadoRuta } from "@/types/estado-jornada";
import type { AgendaCampo, VisitaCampo } from "@/types/campo";
import { EstadoRutaSimple } from "./ui/estado-ruta-simple";
import { TextoExpandible } from "./ui/texto-expandible";
import {
  IconoAlerta,
  IconoCaja,
  IconoCandado,
  IconoCheck,
  IconoChevronAbajo,
  IconoContacto,
  IconoCruz,
  IconoEntrada,
  IconoMapa,
  IconoPin,
  IconoPlay,
  IconoReloj,
  IconoSalida,
  IconoTareas,
} from "./ui/iconos-campo";

interface TarjetaAgendaBaseProps {
  agenda: AgendaCampo;
  /** Posición en la ruta; se muestra en el marcador de los pendientes. */
  orden: number;
  /** Distancia desde tu ubicación cuando hay una ruta calculada. */
  distancia?: string;
  abierta: boolean;
  alternar: () => void;
  qsFecha: string;
  /** Visita abierta del usuario, sea en este local o en otro. */
  visitaAbierta: VisitaCampo | null;
  onMapa: () => void;
  onNovedad: () => void;
}

interface AccionesRepositorProps {
  soloConsulta?: false;
  /** La agenda consultada es la de hoy (solo hoy se marca entrada). */
  hoy: boolean;
  /** Cambia al cerrar el modal de tareas para refrescar el "2/5". */
  revisionTareas: number;
  /** Abre el inventario del local; sin la página de inventario no se muestra. */
  onInventario?: () => void;
  onEntrada: (horarioId?: number) => void;
  onSalida: (visita: VisitaCampo) => void;
  onTareas: () => void;
}

interface ConsultaImpulsadorProps {
  /** El impulsador consulta visitas de UCheck y reporta novedades desde esta vista. */
  soloConsulta: true;
  hoy?: never;
  revisionTareas?: never;
  onInventario?: never;
  onEntrada?: never;
  onSalida?: never;
  onTareas?: never;
}

type TarjetaAgendaRepositorProps = TarjetaAgendaBaseProps &
  (AccionesRepositorProps | ConsultaImpulsadorProps);

const ESTILO: Record<EstadoRuta, { franja: string; pill: string }> = {
  pendiente: {
    franja: "bg-stone-400 dark:bg-stone-500",
    pill: "border-stone-300 bg-stone-100 text-stone-700 dark:border-stone-700 dark:bg-stone-800/70 dark:text-stone-200",
  },
  en_curso: {
    franja: "bg-sky-600 dark:bg-sky-400",
    pill: "border-sky-300 bg-sky-100 text-sky-800 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-300",
  },
  completado: {
    franja: "bg-emerald-600 dark:bg-emerald-400",
    pill: "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
  },
  incompleto: {
    franja: "bg-amber-500 dark:bg-amber-400",
    pill: "border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
  },
  ausente: {
    franja: "bg-red-600 dark:bg-red-400",
    pill: "border-red-300 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-950/60 dark:text-red-300",
  },
};

// Acciones de la visita: ocupan todo el ancho (dos por fila en la visita en curso).
const btnBase =
  "flex min-h-11 min-w-0 grow basis-[calc(50%-0.25rem)] cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm";
const btnPrincipal = `${btnBase} bg-brand-700 text-white shadow-sm hover:bg-brand-800 dark:bg-brand-500 dark:text-brand-950 dark:hover:brightness-110`;
const btnSalida = `${btnBase} ${colorFinalizar}`;
// Tareas e inventario, dentro del bloque de información del local.
// En el celular, ícono arriba y texto abajo: así Tareas, Inventario y Novedad entran en una fila.
const btnInfo =
  "flex min-h-11 min-w-0 cursor-pointer flex-col items-center justify-center gap-0.5 whitespace-nowrap rounded-lg border border-line bg-surface-raised px-1 py-1.5 text-xs font-semibold text-foreground sm:flex-row sm:gap-1 sm:px-2 transition-colors hover:border-brand-500 hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-line disabled:hover:bg-surface-raised";

function Marcador({ estado, orden }: { estado: EstadoRuta; orden: number }) {
  const base =
    "relative grid h-7 w-7 shrink-0 place-items-center rounded-full text-[13px] font-bold sm:h-8 sm:w-8 sm:text-sm";
  if (estado === "completado")
    return (
      <span
        className={`${base} bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950`}
      >
        <IconoCheck className="h-4 w-4" />
      </span>
    );
  if (estado === "en_curso")
    return (
      <span
        className={`${base} bg-sky-600 text-white dark:bg-sky-500 dark:text-sky-950`}
      >
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full bg-sky-500/40 motion-safe:animate-ping dark:bg-sky-400/30"
        />
        <IconoPlay className="relative h-3 w-3 sm:h-3.5 sm:w-3.5" />
      </span>
    );
  if (estado === "incompleto")
    return (
      <span
        className={`${base} bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300`}
      >
        <IconoAlerta className="h-4 w-4" />
      </span>
    );
  if (estado === "ausente")
    return (
      <span
        className={`${base} bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300`}
      >
        <IconoCruz className="h-4 w-4" />
      </span>
    );
  return (
    <span
      className={`${base} ft-display border-2 border-brand-600 bg-surface-raised text-brand-700 dark:border-brand-500 dark:text-brand-200`}
    >
      {orden}
    </span>
  );
}

export function TarjetaAgendaRepositor({
  agenda: a,
  orden,
  distancia,
  abierta,
  alternar,
  hoy,
  qsFecha,
  revisionTareas,
  visitaAbierta,
  onInventario,
  onEntrada,
  onSalida,
  onTareas,
  onMapa,
  onNovedad,
  soloConsulta = false,
}: TarjetaAgendaRepositorProps) {
  const estilo = ESTILO[a.estado];
  const idDetalle = `detalle-agenda-${a.id}`;
  const horarios = a.local.horarios;
  const visitaAqui =
    visitaAbierta?.asignacionId === a.id ? visitaAbierta : null;
  // Novedad solo con la visita iniciada (la del impulsador llega de UCheck como EN_CURSO).
  const enVisita =
    !!visitaAqui || a.visitas.some((v) => v.estado === "EN_CURSO");
  // Las tareas solo se trabajan con la entrada marcada en este local.
  const tareas = useResumenTareasLocal(
    a.id,
    qsFecha,
    visitaAqui?.id ?? null,
    !soloConsulta && (!!visitaAqui || abierta),
    revisionTareas ?? 0,
  );
  const entradaEnCurso =
    visitaAqui?.entrada ??
    a.visitas.find((v) => v.estado === "EN_CURSO")?.entrada;
  const ultima = a.visitas.at(-1);

  const meta = entradaEnCurso
    ? [
        `En el local desde ${formatoHora(entradaEnCurso)}`,
        tareas ? `tareas ${tareas.hechas}/${tareas.total}` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : ultima
      ? ultima.salida
        ? `Presente ${formatoHora(ultima.entrada)}–${formatoHora(ultima.salida)}`
        : `Entrada ${formatoHora(ultima.entrada)} · sin finalizar`
      : [a.local.direccion || a.local.id, distancia]
          .filter(Boolean)
          .join(" · ");

  // Un solo "Marcar entrada": el del próximo horario que todavía no tiene visita.
  const entradasPendientes =
    !soloConsulta && hoy && !visitaAbierta
      ? (horarios.length ? horarios : [null])
          .filter(
            (h) => !a.visitas.some((v) => v.horarioId === (h?.id ?? null)),
          )
          .slice(0, 1)
      : [];
  const otraVisita =
    !soloConsulta && hoy && !visitaAqui && a.estado === "pendiente"
      ? visitaAbierta
      : null;
  const tareasCompletas =
    !!tareas && tareas.total > 0 && tareas.hechas === tareas.total;

  return (
    <article
      className={`relative overflow-hidden rounded-xl border bg-surface-raised shadow-[0_2px_8px_rgba(var(--warm-shadow),0.06)] [content-visibility:auto] ${
        visitaAqui
          ? "border-sky-500/60 ring-2 ring-sky-500/20 dark:border-sky-700 dark:ring-sky-400/20"
          : "border-line"
      }`}
    >
      <span
        aria-hidden="true"
        className={`absolute inset-y-0 left-0 w-1 ${estilo.franja}`}
      />

      {/* El botón del nombre cubre toda la fila; el mapa queda por encima. */}
      <div className="relative flex min-h-14 min-w-0 items-center gap-2.5 py-2 pl-3.5 pr-2 transition-colors hover:bg-surface-soft/50 sm:gap-3 sm:pl-4">
        <Marcador estado={a.estado} orden={orden} />
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={alternar}
            aria-expanded={abierta}
            aria-controls={idDetalle}
            className="block w-full min-w-0 cursor-pointer truncate text-left text-sm font-semibold text-foreground after:absolute after:inset-0 after:rounded-xl after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-focus sm:text-[15px]"
          >
            {a.local.nombre}
          </button>
          <p className="truncate text-[11px] text-muted sm:text-xs">{meta}</p>
        </div>
        {soloConsulta ? (
          <EstadoRutaSimple estado={a.estado} />
        ) : (
          <span
            className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-bold sm:text-[11px] ${estilo.pill}`}
          >
            {RUTA[a.estado].etiqueta}
          </span>
        )}
        <button
          type="button"
          onClick={onMapa}
          aria-label={`Ver ${a.local.nombre} en el mapa`}
          title="Ver en el mapa"
          className="relative z-10 grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-lg border border-line bg-surface-raised text-brand-700 transition-colors before:absolute before:-inset-1.5 before:content-[''] hover:border-brand-500 hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus dark:text-brand-200"
        >
          <IconoMapa className="h-4 w-4" />
        </button>
        <IconoChevronAbajo
          className={`pointer-events-none h-4 w-4 shrink-0 text-muted motion-safe:transition-transform ${abierta ? "rotate-180" : ""}`}
        />
      </div>

      {abierta ? (
        <div
          id={idDetalle}
          className="space-y-2.5 border-t border-line/70 py-2.5 pl-3.5 pr-2.5 sm:space-y-3 sm:py-3 sm:pl-4 sm:pr-3"
        >
          {/* Sin foto: en el celular cada línea de alto cuenta. */}
          <div className="min-w-0 space-y-1">
            <p className="flex min-w-0 items-center gap-1.5 text-xs text-foreground">
              <IconoPin className="h-3.5 w-3.5 shrink-0 text-muted" />
              {a.local.direccion ? (
                <TextoExpandible texto={a.local.direccion} />
              ) : (
                <span className="text-muted">Sin dirección cargada</span>
              )}
            </p>
            {a.esBackup || a.heredada ? (
              <p className="flex min-w-0 items-start gap-1.5 text-xs text-foreground">
                <IconoContacto className="mt-px h-3.5 w-3.5 shrink-0 text-muted" />
                <span className="min-w-0 break-words">
                  {a.heredada ? "Local de" : "Reemplazo de"} {a.titular}
                </span>
              </p>
            ) : null}

            {soloConsulta ? (
              <div
                className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted sm:text-xs"
                aria-label="Horario de atención"
              >
                <IconoReloj className="h-3.5 w-3.5 shrink-0" />
                {horarios.length
                  ? horarios.map((h) => (
                      <span key={h.id} className="font-mono">
                        {h.entrada}–{h.salida}
                      </span>
                    ))
                  : "Sin horario fijado"}
              </div>
            ) : null}
          </div>

          <div className="grid auto-cols-fr grid-flow-col gap-1.5">
            {/* Tareas e inventario se usan dentro del local: con la entrada marcada. */}
            {!soloConsulta ? (
              <button
                type="button"
                onClick={onTareas}
                disabled={!visitaAqui}
                title={
                  visitaAqui
                    ? undefined
                    : "Iniciá la visita para ver las tareas"
                }
                aria-label={
                  tareas
                    ? `Tareas de ${a.local.nombre}: ${tareas.hechas} de ${tareas.total} hechas`
                    : `Tareas de ${a.local.nombre}`
                }
                className={btnInfo}
              >
                <IconoTareas className="h-3.5 w-3.5 shrink-0" />
                <span className="inline-flex items-center gap-1">
                  Tareas
                  {tareas ? (
                    <span
                      className={`rounded-md px-1.5 text-[11px] font-bold tabular-nums ${
                        tareasCompletas
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          : "bg-brand-100 text-brand-800 dark:bg-brand-900 dark:text-brand-100"
                      }`}
                    >
                      {tareas.hechas}/{tareas.total}
                    </span>
                  ) : null}
                </span>
              </button>
            ) : null}
            {!soloConsulta && onInventario ? (
              <button
                type="button"
                onClick={onInventario}
                disabled={!visitaAqui}
                title={
                  visitaAqui
                    ? undefined
                    : "Iniciá la visita para usar el inventario"
                }
                className={btnInfo}
              >
                <IconoCaja className="h-3.5 w-3.5 shrink-0" />
                Inventario
              </button>
            ) : null}
            <button
              type="button"
              onClick={onNovedad}
              disabled={!enVisita}
              title={
                enVisita
                  ? undefined
                  : "Iniciá la visita para reportar una novedad"
              }
              aria-label={`Reportar una novedad de ${a.local.nombre}`}
              className={btnInfo}
            >
              <IconoAlerta className="h-3.5 w-3.5 shrink-0" />
              Novedad
            </button>
          </div>

          {a.visitas.length ? (
            <ul
              aria-label={`Visitas a ${a.local.nombre}`}
              className="space-y-1 rounded-lg bg-surface-soft/70 px-2.5 py-1.5 text-[11px] sm:text-xs"
            >
              {a.visitas.map((v) => (
                <li
                  key={v.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-0.5"
                >
                  {soloConsulta ? (
                    <span className="font-mono text-muted">
                      {formatoFechaCalendario(v.fecha)}
                    </span>
                  ) : null}
                  <span className="inline-flex items-center gap-1 text-foreground">
                    <IconoEntrada className="h-3.5 w-3.5 shrink-0 text-muted" />
                    Entrada{" "}
                    <b className="font-mono">{formatoHora(v.entrada)}</b>
                  </span>
                  {v.salida ? (
                    <span className="inline-flex items-center gap-1 text-foreground">
                      <IconoSalida className="h-3.5 w-3.5 shrink-0 text-muted" />
                      Salida{" "}
                      <b className="font-mono">{formatoHora(v.salida)}</b>
                    </span>
                  ) : null}
                  {v.salida ? (
                    // Cuánto duró la visita, a la derecha de la entrada y la salida.
                    <span
                      className="ml-auto inline-flex items-center gap-1 font-semibold text-foreground"
                      title="Duración de la visita"
                    >
                      <IconoReloj className="h-3.5 w-3.5 shrink-0 text-muted" />
                      {formatoDuracionMinutos(
                        (Date.parse(v.salida) - Date.parse(v.entrada)) / 60_000,
                      )}
                    </span>
                  ) : v.estado === "INCOMPLETA" ? (
                    // Se inició otro día y nunca se finalizó: la salida queda vacía.
                    <span className="inline-flex items-center gap-1 text-foreground">
                      <IconoSalida className="h-3.5 w-3.5 shrink-0 text-muted" />
                      Salida <b className="font-mono text-muted">—</b>
                      <span className="font-semibold text-amber-700 dark:text-amber-300">
                        · sin finalizar
                      </span>
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}

          {!soloConsulta && visitaAqui ? (
            <button
              type="button"
              onClick={() => onSalida?.(visitaAqui)}
              aria-label={`Finalizar la visita a ${a.local.nombre}`}
              className={`${btnSalida} w-full`}
            >
              <IconoSalida className="h-4 w-4 shrink-0" />
              Finalizar Visita
            </button>
          ) : entradasPendientes.length ? (
            <div className="space-y-2">
              {entradasPendientes.map((h) => (
                <button
                  key={h?.id ?? 0}
                  type="button"
                  onClick={() => onEntrada?.(h?.id)}
                  className={`${btnPrincipal} w-full`}
                >
                  <IconoEntrada className="h-4 w-4 shrink-0" />
                  Iniciar Visita
                </button>
              ))}
              <p className="flex items-center justify-center gap-1 text-[11px] text-muted sm:text-xs">
                <IconoCandado className="h-3 w-3 shrink-0" />
                Tareas e inventario se habilitan al iniciar la visita.
              </p>
            </div>
          ) : null}

          {otraVisita ? (
            <p className="flex items-start gap-1.5 text-[11px] text-muted sm:text-xs">
              <IconoCandado className="mt-px h-3.5 w-3.5 shrink-0" />
              <span>
                Tenés una visita en curso en <b>{otraVisita.local.nombre}</b>.
                Finalizala para iniciar la visita acá.
              </span>
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
