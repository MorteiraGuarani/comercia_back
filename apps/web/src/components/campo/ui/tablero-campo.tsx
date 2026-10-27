import Link from "next/link";
import type { ReactNode } from "react";
import type { EstadoPresentismo, EstadoRuta } from "@/types/estado-jornada";
import type { TonoHoy } from "@/types/hoy-en-campo";
import { IconoChevronAbajo } from "./iconos-campo";
import { formatoDuracionMinutos, minutosEntreHoras } from "@/utils/duracion";

// Piezas de los tableros de inicio (supervisor "Hoy en campo" y repositor
// "Tu día"): indicador con semáforo, filas de "Atender ahora" y secciones.

export const enfoqueTablero =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus";

export const PRESENTISMO_UI: Record<
  EstadoPresentismo,
  { etiqueta: string; pill: string; anillo: string; barra: string; tono: TonoHoy }
> = {
  PRESENTE: {
    etiqueta: "Presente",
    pill: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
    anillo: "border-emerald-500 dark:border-emerald-400",
    barra: "bg-emerald-600 dark:bg-emerald-500",
    tono: "ok",
  },
  TARDE: {
    etiqueta: "Tarde",
    pill: "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300",
    anillo: "border-amber-500 dark:border-amber-400",
    barra: "bg-amber-500 dark:bg-amber-400",
    tono: "warn",
  },
  INCOMPLETO: {
    etiqueta: "Incompleto",
    pill: "bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300",
    anillo: "border-orange-500 dark:border-orange-400",
    barra: "bg-orange-500 dark:bg-orange-400",
    tono: "warn",
  },
  AUSENTE: {
    etiqueta: "Ausente",
    pill: "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300",
    anillo: "border-red-600 dark:border-red-400",
    barra: "bg-red-600 dark:bg-red-500",
    tono: "bad",
  },
  SIN_REGISTRO: {
    etiqueta: "Sin entrada",
    pill: "bg-stone-100 text-stone-700 dark:bg-stone-800/70 dark:text-stone-200",
    anillo: "border-stone-300 dark:border-stone-600",
    barra: "bg-stone-400 dark:bg-stone-500",
    tono: "info",
  },
};

export const ORDEN_PRESENTISMO: EstadoPresentismo[] = [
  "PRESENTE",
  "TARDE",
  "INCOMPLETO",
  "AUSENTE",
  "SIN_REGISTRO",
];

export const RUTA_PILL: Record<EstadoRuta, string> = {
  pendiente: "bg-stone-100 text-stone-700 dark:bg-stone-800/70 dark:text-stone-200",
  en_curso: "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300",
  completado: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
  incompleto: "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300",
  ausente: "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300",
};

export const TONO_CAJA: Record<TonoHoy, string> = {
  bad: "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300",
  warn: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
  info: "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300",
  ok: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
};

export const SEMAFORO: Record<TonoHoy, { clase: string; etiqueta: string }> = {
  bad: { clase: "bg-red-600 dark:bg-red-400", etiqueta: "Crítico" },
  warn: { clase: "bg-amber-500 dark:bg-amber-400", etiqueta: "Revisar" },
  info: { clase: "bg-sky-500 dark:bg-sky-400", etiqueta: "Informativo" },
  ok: { clase: "bg-emerald-600 dark:bg-emerald-400", etiqueta: "En orden" },
};

const SOMBRA = "shadow-[0_2px_8px_rgba(var(--warm-shadow),0.06)]";

/** Tarjeta de indicador: letra, nombre, semáforo, valor grande, barra y nota. */
export function TarjetaIndicador({
  letra,
  nombre,
  tono,
  valor,
  barra,
  nota,
  href,
  onClick,
  etiqueta,
  disabled = false,
}: {
  letra: string;
  nombre: string;
  tono: TonoHoy;
  valor: ReactNode;
  barra?: ReactNode;
  nota: ReactNode;
  href?: string;
  onClick?: () => void;
  etiqueta: string;
  disabled?: boolean;
}) {
  const clase = `flex min-w-0 flex-col gap-1.5 rounded-xl border border-line bg-surface-raised p-3 text-left ${SOMBRA} transition-colors disabled:cursor-not-allowed disabled:opacity-50 sm:p-4 ${enfoqueTablero} ${!disabled ? "cursor-pointer hover:border-brand-500 hover:bg-surface-soft/40" : ""}`;
  const contenido = (
    <>
      <span className="flex items-center justify-between gap-1.5">
        <span className="flex min-w-0 items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">
          <span className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded bg-surface-soft text-[10px] text-foreground">
            {letra}
          </span>
          <span className="truncate">{nombre}</span>
        </span>
        <span
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${SEMAFORO[tono].clase}`}
          title={SEMAFORO[tono].etiqueta}
        />
      </span>
      <span className="ft-display truncate text-3xl font-bold leading-none tabular-nums text-foreground sm:text-4xl">
        {valor}
      </span>
      {barra}
      <span className="text-[11px] leading-snug text-muted sm:text-xs">{nota}</span>
    </>
  );
  return href && !disabled ? (
    <Link href={href} aria-label={etiqueta} className={clase}>
      {contenido}
    </Link>
  ) : (
    <button type="button" disabled={disabled} onClick={onClick} aria-label={etiqueta} className={clase}>
      {contenido}
    </button>
  );
}

/** Fila de "Atender ahora": ícono de color, título, detalle y acción. */
export function FilaAtencion({
  tono,
  icono,
  titulo,
  detalle,
  accion,
  href,
  onClick,
}: {
  tono: TonoHoy;
  icono: ReactNode;
  titulo: string;
  detalle: string;
  accion: string;
  href?: string;
  onClick?: () => void;
}) {
  const clase = `grid w-full min-w-0 cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 border-t border-line px-3 py-2.5 text-left transition-colors first:border-t-0 hover:bg-surface-soft/60 ${enfoqueTablero} focus-visible:ring-inset`;
  const contenido = (
    <>
      <span aria-hidden="true" className={`grid h-8 w-8 place-items-center rounded-lg [&_svg]:h-4 [&_svg]:w-4 ${TONO_CAJA[tono]}`}>
        {icono}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-semibold text-foreground sm:text-sm">{titulo}</span>
        <span className="block truncate text-[11px] text-muted sm:text-xs">{detalle}</span>
      </span>
      <span className="whitespace-nowrap rounded-lg bg-brand-100 px-2 py-1 text-xs font-bold text-brand-800 dark:bg-brand-900 dark:text-brand-100">
        {accion}
      </span>
    </>
  );
  return href ? (
    <Link href={href} className={clase}>
      {contenido}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={clase}>
      {contenido}
    </button>
  );
}

/** Contenedor de las filas de "Atender ahora" (o el mensaje si no hay). */
export function ListaAtencion({ children, vacio }: { children: ReactNode; vacio: boolean }) {
  return (
    <div className={`overflow-hidden rounded-2xl border border-line bg-surface-raised ${SOMBRA}`}>
      {vacio ? (
        <p className="p-4 text-center text-sm text-muted">Nada urgente por ahora. Todo en orden.</p>
      ) : (
        children
      )}
    </div>
  );
}

/** Sección desplegable con título en versalitas y resumen a la derecha. */
export function SeccionTablero({
  titulo,
  resumen,
  destacado = false,
  children,
}: {
  titulo: string;
  resumen: string;
  destacado?: boolean;
  children: ReactNode;
}) {
  return (
    <details open className="group/seccion min-w-0 space-y-2">
      <summary
        className={`flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg px-0.5 [&::-webkit-details-marker]:hidden ${enfoqueTablero}`}
      >
        <span className="text-[11px] font-bold uppercase tracking-wide text-muted">{titulo}</span>
        <span
          className={`ml-auto text-xs ${destacado ? "font-bold text-red-700 dark:text-red-300" : "text-muted"}`}
        >
          {resumen}
        </span>
        <span
          aria-hidden="true"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-line bg-surface-raised text-muted"
        >
          <IconoChevronAbajo className="h-4 w-4 -rotate-90 motion-safe:transition-transform group-open/seccion:rotate-0" />
        </span>
      </summary>
      {children}
    </details>
  );
}

/** Encabezado del tablero con el botón de actualizar. */
/** Inicio (primera entrada del día), final (última salida) y cuánto duró la jornada. */
export function LineaJornada({ inicio, fin }: { inicio: string | null; fin: string | null }) {
  if (!inicio) return null;
  const minutos = minutosEntreHoras(inicio, fin);
  return (
    <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 text-[11px] text-muted">
      <span>
        Inicio <b className="font-mono font-semibold text-foreground">{inicio}</b>
      </span>
      <span>
        Final <b className="font-mono font-semibold text-foreground">{fin ?? "—"}</b>
      </span>
      {minutos !== null ? (
        <span className="font-semibold text-foreground">· {formatoDuracionMinutos(minutos)}</span>
      ) : null}
    </span>
  );
}

/** "Actualizado hh:mm": vuelve a pedir los datos del tablero. */
export function BotonActualizarTablero({
  cargando,
  actualizado,
  onActualizar,
}: {
  cargando: boolean;
  actualizado: string | null;
  onActualizar: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onActualizar}
      disabled={cargando}
      aria-label="Actualizar datos del tablero"
      className={`inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg px-1 text-xs text-muted transition-colors hover:text-foreground disabled:cursor-wait ${enfoqueTablero}`}
    >
      <span
        aria-hidden="true"
        className={`h-2 w-2 rounded-full bg-emerald-600 dark:bg-emerald-400 ${cargando ? "motion-safe:animate-pulse" : "motion-safe:animate-ping [animation-duration:2.4s]"}`}
      />
      {cargando ? (
        "Actualizando…"
      ) : actualizado ? (
        <>
          Actualizado <b className="font-mono font-medium text-foreground">{actualizado}</b>
        </>
      ) : (
        "Actualizar"
      )}
    </button>
  );
}

/**
 * KPIs de un detalle de Inicio, todos en una fila. Tocar uno filtra la lista
 * de abajo; tocarlo otra vez vuelve a mostrar todo.
 */
export function ConteosFiltro({
  etiqueta,
  items,
  activo,
  onFiltro,
}: {
  etiqueta: string;
  items: {
    clave: string;
    etiqueta: string;
    valor: number;
    detalle?: string;
    clase?: string;
    punto?: string;
    descripcion?: string;
  }[];
  activo: string | null;
  onFiltro: (clave: string | null) => void;
}) {
  return (
    <div
      role="group"
      aria-label={etiqueta}
      className="grid min-w-0 gap-1.5"
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map((i) => {
        const elegido = activo === i.clave;
        return (
          <button
            key={i.clave}
            type="button"
            aria-pressed={elegido}
            aria-label={i.descripcion}
            onClick={() => onFiltro(elegido ? null : i.clave)}
            className={`min-h-11 min-w-0 cursor-pointer rounded-lg border px-1.5 py-1.5 text-left transition-[border-color,box-shadow,opacity] sm:px-2 ${enfoqueTablero} ${
              elegido
                ? "border-brand-600 bg-surface-raised ring-2 ring-brand-600/25 dark:border-brand-400 dark:ring-brand-400/30"
                : `border-transparent bg-surface-soft hover:border-line ${activo ? "opacity-60 hover:opacity-100" : ""}`
            }`}
          >
            <b className={`ft-display block text-xl leading-tight tabular-nums ${i.clase ?? "text-foreground"}`}>
              {i.valor}
            </b>
            <span className="flex min-w-0 items-center gap-1 text-[10px] text-muted sm:text-[11px]">
              {i.punto ? (
                <i aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${i.punto}`} />
              ) : null}
              <span className="truncate">{i.etiqueta}</span>
            </span>
            {i.detalle ? (
              <span className="block truncate text-[10px] tabular-nums text-muted">{i.detalle}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
