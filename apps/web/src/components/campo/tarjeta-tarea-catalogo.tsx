"use client";

import { BotonEditar } from "@/components/boton-editar";
import { Modal } from "@/components/modal";
import { formatoFechaCalendario } from "@/utils/fechas";
import type { TareaCampo } from "@/types/campo";
import {
  IconoArchivo,
  IconoCalendario,
  IconoCamara,
  IconoGlobo,
  IconoOjo,
  IconoPin,
  IconoTareas,
} from "./ui/iconos-campo";

// Tarjeta del catálogo de tareas y hoja "Ver instrucción". Cada categoría
// tiene su color para reconocerla de un vistazo.

const CATEGORIA_UI: Record<string, { franja: string; caja: string; texto: string; chip: string }> = {
  Góndola: {
    franja: "bg-emerald-500 dark:bg-emerald-400",
    caja: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
    texto: "text-emerald-700 dark:text-emerald-300",
    chip: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300",
  },
  Limpieza: {
    franja: "bg-sky-500 dark:bg-sky-400",
    caja: "bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300",
    texto: "text-sky-700 dark:text-sky-300",
    chip: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-300",
  },
  Precios: {
    franja: "bg-amber-500 dark:bg-amber-400",
    caja: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
    texto: "text-amber-700 dark:text-amber-300",
    chip: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300",
  },
  Exhibición: {
    franja: "bg-violet-500 dark:bg-violet-400",
    caja: "bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300",
    texto: "text-violet-700 dark:text-violet-300",
    chip: "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950/50 dark:text-violet-300",
  },
  Vencimientos: {
    franja: "bg-red-500 dark:bg-red-400",
    caja: "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300",
    texto: "text-red-700 dark:text-red-300",
    chip: "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300",
  },
  Relevamiento: {
    franja: "bg-indigo-500 dark:bg-indigo-400",
    caja: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300",
    texto: "text-indigo-700 dark:text-indigo-300",
    chip: "border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-300",
  },
  "Control de Stock": {
    franja: "bg-orange-500 dark:bg-orange-400",
    caja: "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300",
    texto: "text-orange-700 dark:text-orange-300",
    chip: "border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-900 dark:bg-orange-950/50 dark:text-orange-300",
  },
};
const CATEGORIA_OTRA = {
  franja: "bg-stone-400 dark:bg-stone-500",
  caja: "bg-stone-100 text-stone-700 dark:bg-stone-800/70 dark:text-stone-200",
  texto: "text-stone-600 dark:text-stone-300",
  chip: "border-stone-200 bg-stone-50 text-stone-700 dark:border-stone-700 dark:bg-stone-800/70 dark:text-stone-200",
};

const PILL = "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold";
const PILL_ROJO = `${PILL} border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300`;
const PILL_VERDE = `${PILL} border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300`;
const PILL_GRIS = `${PILL} border-stone-200 bg-stone-50 text-stone-700 dark:border-stone-700 dark:bg-stone-800/70 dark:text-stone-200`;
const PILL_AMBAR = `${PILL} border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300`;
const PILL_CELESTE = `${PILL} border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-300`;

const enfoque = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus";

function categoriaDe(t: TareaCampo) {
  const nombre = t.categoria || "Góndola";
  return { nombre, ui: CATEGORIA_UI[nombre] ?? CATEGORIA_OTRA };
}

function destinatarioTexto(t: TareaCampo) {
  return t.destinatario === "AMBOS" ? "Ambos equipos" : t.destinatario === "REPOSITOR" ? "Repositor" : "Impulsador";
}

function alcanceTexto(t: TareaCampo) {
  if (t.todosLocales) return "Todos los locales";
  const n = t.locales?.length ?? 0;
  return `${n}${n >= 50 ? "+" : ""} ${n === 1 ? "local" : "locales"}`;
}

function vigenciaTexto(t: TareaCampo) {
  const desde = formatoFechaCalendario(t.fechaDesde) ?? "—";
  const hasta = formatoFechaCalendario(t.fechaHasta);
  return hasta ? `${desde} – ${hasta}` : `Desde ${desde} · sin fin`;
}

function Insignias({ t }: { t: TareaCampo }) {
  return (
    <>
      {t.archivadaEn ? (
        <span className={PILL_GRIS}>
          <IconoArchivo className="h-3 w-3" />
          Archivada
        </span>
      ) : !t.activo ? (
        <span className={PILL_GRIS}>Inactiva</span>
      ) : (
        <span className={PILL_VERDE}>Activa</span>
      )}
      {t.esObligatoria ? <span className={PILL_ROJO}>Obligatoria</span> : null}
      {t.requiereFotos ? (
        <span className={t.fotosObligatorias ? PILL_AMBAR : PILL_CELESTE}>
          <IconoCamara className="h-3 w-3" />
          {t.fotosObligatorias ? "Fotos obligatorias" : "Fotos opcionales"}
        </span>
      ) : null}
    </>
  );
}

export function TarjetaTareaCatalogo({
  tarea: t,
  puedeEditar,
  puedeArchivar,
  ocupado,
  onVerInstruccion,
  onEditar,
  onArchivar,
  onHistorial,
}: {
  tarea: TareaCampo;
  puedeEditar: boolean;
  puedeArchivar: boolean;
  ocupado: boolean;
  onVerInstruccion: () => void;
  onEditar: () => void;
  onArchivar: () => void;
  onHistorial: () => void;
}) {
  const categoria = categoriaDe(t);
  const apagada = !!t.archivadaEn || !t.activo;
  return (
    <article className="relative overflow-hidden rounded-xl border border-line bg-surface-raised shadow-[0_2px_8px_rgba(var(--warm-shadow),0.06)] [content-visibility:auto]">
      <span
        aria-hidden="true"
        className={`absolute inset-y-0 left-0 w-1 ${apagada ? CATEGORIA_OTRA.franja : categoria.ui.franja}`}
      />
      <div className={`p-3 pl-4 ${apagada ? "opacity-80" : ""}`}>
        <div className="flex min-w-0 items-start gap-3">
          <span
            aria-hidden="true"
            className={`hidden h-10 w-10 shrink-0 place-items-center rounded-xl sm:grid ${categoria.ui.caja}`}
          >
            <IconoTareas className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className={`truncate text-[11px] font-bold uppercase tracking-wide ${categoria.ui.texto}`}>
              {categoria.nombre}
              <span className="font-semibold normal-case tracking-normal text-muted"> · {destinatarioTexto(t)}</span>
            </p>
            <h3 className="break-words text-sm font-bold leading-snug text-foreground">{t.nombre}</h3>
          </div>
          <button
            type="button"
            onClick={onVerInstruccion}
            aria-label={`Ver instrucción de ${t.nombre}`}
            className={`inline-flex min-h-10 shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap rounded-lg bg-emerald-600 px-2.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-emerald-700 dark:bg-emerald-500 dark:text-emerald-950 dark:hover:bg-emerald-400 ${enfoque}`}
          >
            <IconoOjo className="h-3.5 w-3.5" />
            Ver instrucción
          </button>
        </div>

        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <Insignias t={t} />
        </div>

        <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
          <span className="inline-flex items-center gap-1">
            {t.todosLocales ? <IconoGlobo className="h-3.5 w-3.5" /> : <IconoPin className="h-3.5 w-3.5" />}
            {alcanceTexto(t)}
          </span>
          <span className="inline-flex items-center gap-1">
            <IconoCalendario className="h-3.5 w-3.5" />
            {vigenciaTexto(t)}
          </span>
        </p>

        <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-line/70 pt-2">
          <button
            type="button"
            onClick={onHistorial}
            className={`min-h-10 cursor-pointer rounded-lg px-1.5 text-xs font-semibold text-muted transition-colors hover:text-foreground hover:underline ${enfoque}`}
          >
            Historial · v{t.version}
          </button>
          {!t.archivadaEn && (puedeEditar || puedeArchivar) ? (
            <div className="flex items-center gap-1.5">
              {puedeEditar ? (
                <BotonEditar onClick={onEditar} etiqueta={`Editar tarea ${t.nombre}`} modo="texto" className="min-h-10 text-xs" />
              ) : null}
              {puedeArchivar ? (
                <button
                  type="button"
                  onClick={onArchivar}
                  disabled={ocupado}
                  aria-label={`Archivar ${t.nombre}`}
                  title="Archivar: deja de asignarse, conserva su historial"
                  className={`inline-flex min-h-10 cursor-pointer items-center gap-1 whitespace-nowrap rounded-lg border border-line bg-surface-raised px-2.5 text-xs font-semibold text-muted transition-colors hover:border-red-400 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:text-red-300 ${enfoque}`}
                >
                  <IconoArchivo className="h-3.5 w-3.5" />
                  Archivar
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

/** Hoja inferior (en celular) con la instrucción completa y el alcance. */
export function HojaInstruccionTarea({ tarea: t, cerrar }: { tarea: TareaCampo; cerrar: () => void }) {
  const categoria = categoriaDe(t);
  const fotos = t.requiereFotos
    ? t.fotosObligatorias
      ? "Antes y después · obligatorias"
      : "Antes y después · opcionales"
    : "No pide fotos";
  return (
    <Modal titulo={t.nombre} abierto onCerrar={cerrar} hojaMovil ancho="lg">
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap gap-1.5">
          <span className={`${PILL} ${categoria.ui.chip}`}>{categoria.nombre}</span>
          <Insignias t={t} />
        </div>

        <section aria-labelledby={`instruccion-${t.id}`} className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
          <h3 id={`instruccion-${t.id}`} className="text-[11px] font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
            Instrucción
          </h3>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
            {t.descripcion?.trim() || "Esta tarea no tiene instrucciones adicionales."}
          </p>
        </section>

        <dl className="grid grid-cols-2 gap-2">
          {[
            ["Alcance", alcanceTexto(t)],
            ["Para", destinatarioTexto(t)],
            ["Vigencia", vigenciaTexto(t)],
            ["Fotos", fotos],
          ].map(([k, v]) => (
            <div key={k} className="min-w-0 rounded-xl border border-line bg-surface-raised px-3 py-2">
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">{k}</dt>
              <dd className="mt-0.5 break-words text-xs font-semibold text-foreground">{v}</dd>
            </div>
          ))}
        </dl>

        {!t.todosLocales && t.locales?.length ? (
          <section aria-labelledby={`locales-${t.id}`}>
            <h3 id={`locales-${t.id}`} className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">
              Locales
            </h3>
            <ul className="flex flex-wrap gap-1.5">
              {t.locales.map(({ local }) => (
                <li key={local.id} className={PILL_GRIS}>
                  <IconoPin className="h-3 w-3" />
                  {local.nombre}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <button
          type="button"
          onClick={cerrar}
          className={`flex min-h-11 w-full cursor-pointer items-center justify-center rounded-lg border border-line bg-surface-raised px-4 text-sm font-semibold text-foreground transition-colors hover:bg-surface-soft ${enfoque}`}
        >
          Cerrar
        </button>
      </div>
    </Modal>
  );
}
