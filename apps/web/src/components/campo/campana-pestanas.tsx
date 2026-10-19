"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { horaOFechaCorta } from "@/utils/fechas";
import type {
  AvisoEnviadoItem,
  AvisoRecibidoItem,
  NovedadCampoItem,
  NovedadesResponse,
  PrioridadNovedad,
} from "@/types/campo";
import type { RespuestaPaginada } from "@/types/paginacion";

// Listas cortas de la campana: lo último de avisos y novedades. El historial
// completo, los filtros y el alta viven en sus páginas.

const LIMITE = 6;

const fila =
  "flex w-full min-w-0 cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface-raised p-3 text-left transition-colors hover:border-brand-500/50 hover:bg-surface-soft/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus";

function Estado({ cargando, error, vacio }: { cargando: boolean; error: string; vacio: string | null }) {
  if (cargando)
    return <p role="status" className="py-10 text-center text-xs text-muted">Cargando…</p>;
  if (error)
    return <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-100">{error}</p>;
  if (vacio)
    return <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">{vacio}</p>;
  return null;
}

/** Avisos: el líder ve los que envió; el personal de campo, los que recibió. */
export function ListaAvisosCampana({
  esLider,
  onAbrir,
  onIrAlHistorial,
}: {
  esLider: boolean;
  onAbrir: (id: number) => void;
  onIrAlHistorial: () => void;
}) {
  const [items, setItems] = useState<(AvisoRecibidoItem | AvisoEnviadoItem)[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let vigente = true;
    apiFetch<RespuestaPaginada<AvisoRecibidoItem | AvisoEnviadoItem>>(
      `/campo/avisos/${esLider ? "enviados" : "recibidos"}?page=1&limit=${LIMITE}`,
    )
      .then((r) => {
        if (vigente) setItems(r.items);
      })
      .catch((e: unknown) => {
        if (vigente) setError(e instanceof Error ? e.message : "No se pudieron cargar los avisos");
      });
    return () => {
      vigente = false;
    };
  }, [esLider]);

  const estado = (
    <Estado
      cargando={!items && !error}
      error={error}
      vacio={items && !items.length ? (esLider ? "Todavía no enviaste avisos." : "No recibiste avisos.") : null}
    />
  );
  if (!items?.length) return estado;

  return (
    <ul aria-label={esLider ? "Últimos avisos enviados" : "Últimos avisos recibidos"} className="space-y-2">
      {items.map((a) => {
        const enviado = esLider ? (a as AvisoEnviadoItem) : null;
        const recibido = esLider ? null : (a as AvisoRecibidoItem);
        const total = enviado?.total ?? 1;
        const leidos = enviado ? (enviado.leidoPor ?? (enviado.leido ? 1 : 0)) : 0;
        return (
          <li key={a.id}>
            <button
              type="button"
              // El detalle marca el aviso como leído; para los enviados se abre el historial.
              onClick={() => (recibido ? onAbrir(a.id) : onIrAlHistorial())}
              className={fila}
            >
              <span
                aria-hidden="true"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-purple-200/60 bg-purple-100 text-purple-800 dark:border-purple-800/40 dark:bg-purple-950/60 dark:text-purple-300"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                </svg>
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-start justify-between gap-2">
                  <span className={`line-clamp-2 text-[13px] leading-snug ${recibido && !recibido.leido ? "font-semibold text-foreground" : "text-foreground"}`}>
                    {a.mensaje}
                  </span>
                  {recibido && !recibido.leido ? (
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-red-600 dark:bg-red-500" aria-label="Sin leer" />
                  ) : null}
                </span>
                <span className="mt-1 flex flex-wrap items-center justify-between gap-x-2 text-[11px] text-muted">
                  <span className="truncate">
                    {recibido
                      ? `De ${recibido.emisor.nombre} ${recibido.emisor.apellido}`
                      : enviado?.destinatario
                        ? `Para ${enviado.destinatario.nombre} ${enviado.destinatario.apellido}`
                        : enviado?.tipo === "EQUIPO"
                          ? "Para todo el equipo"
                          : `Para ${total} personas`}
                  </span>
                  <span className="shrink-0 font-mono text-[10px]">
                    {enviado ? `${Math.min(leidos, total)}/${total} leídos · ` : ""}
                    {horaOFechaCorta(a.creadoAt)}
                  </span>
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

const PRIORIDAD: Record<PrioridadNovedad, { punto: string; etiqueta: string }> = {
  CRITICA: { punto: "bg-red-600 dark:bg-red-400", etiqueta: "Crítica" },
  ALTA: { punto: "bg-amber-500 dark:bg-amber-400", etiqueta: "Alta" },
  NORMAL: { punto: "bg-stone-400 dark:bg-stone-500", etiqueta: "Normal" },
};

/** Novedades abiertas: las propias (campo) o las del equipo (líder). */
export function ListaNovedadesCampana({
  esLider,
  onAbrir,
}: {
  esLider: boolean;
  onAbrir: (id: number) => void;
}) {
  const [datos, setDatos] = useState<{ items: NovedadCampoItem[]; abiertas: number } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let vigente = true;
    apiFetch<NovedadesResponse>(`/campo/novedades?estado=ABIERTA&page=1&limit=${LIMITE}`)
      .then((r) => {
        if (vigente) setDatos({ items: r.items, abiertas: r.counts.abierta });
      })
      .catch((e: unknown) => {
        if (vigente) setError(e instanceof Error ? e.message : "No se pudieron cargar las novedades");
      });
    return () => {
      vigente = false;
    };
  }, []);

  if (!datos?.items.length)
    return (
      <Estado
        cargando={!datos && !error}
        error={error}
        vacio={datos ? "No hay novedades abiertas." : null}
      />
    );

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted">
        {datos.abiertas} {datos.abiertas === 1 ? "novedad abierta" : "novedades abiertas"}
        {datos.abiertas > datos.items.length ? ` · se muestran las ${datos.items.length} más recientes` : ""}
      </p>
      <ul aria-label="Novedades abiertas" className="space-y-2">
        {datos.items.map((n) => (
          <li key={n.id}>
            <button type="button" onClick={() => onAbrir(n.id)} className={fila}>
              <span
                aria-hidden="true"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-red-200/60 bg-red-100 text-red-800 dark:border-red-800/40 dark:bg-red-950/60 dark:text-red-300"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${PRIORIDAD[n.prioridad].punto}`}
                    title={`Prioridad ${PRIORIDAD[n.prioridad].etiqueta}`}
                  />
                  <span className="truncate text-[13px] font-semibold text-foreground">{n.titulo}</span>
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-muted">
                  {[
                    n.tipo.charAt(0) + n.tipo.slice(1).toLowerCase(),
                    n.local.nombre,
                    esLider ? n.usuario.nombre : null,
                    horaOFechaCorta(n.creadoAt),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
