"use client";

import type { LocalCampo } from "@/types/campo";
import { FotoLocal } from "./ui/foto-local";
import { IconoPin } from "./ui/iconos-campo";
import { AccionesItinerario } from "./acciones-itinerario";
import { TextoExpandible } from "./ui/texto-expandible";

// Tarjeta de punto de venta (vista celular de PDV y rutas): imagen del local,
// CardCode, ubicación en OCRD y quién lo atiende.

const iniciales = (nombre: string, apellido: string) =>
  `${nombre[0] ?? ""}${apellido[0] ?? ""}`.toUpperCase();

export function TarjetaPdv({
  local,
  onInformacion,
  onItinerario,
  onAsignacion,
}: {
  local: LocalCampo;
  onInformacion: () => void;
  onItinerario: () => void;
  onAsignacion: () => void;
}) {
  const asignaciones = local.asignaciones ?? [];
  const ubicado = local.latitud !== null && local.longitud !== null;
  return (
    <article className="relative overflow-hidden rounded-xl border border-line bg-surface-raised shadow-[0_2px_8px_rgba(var(--warm-shadow),0.06)] [content-visibility:auto]">
      <span
        aria-hidden="true"
        className={`absolute inset-y-0 left-0 w-1 ${ubicado ? "bg-emerald-600 dark:bg-emerald-400" : "bg-amber-500 dark:bg-amber-400"}`}
      />
      <div className="p-3 pl-4">
        <div className="flex min-w-0 items-start gap-3">
          <FotoLocal
            nombre={local.nombre}
            className="w-20 shrink-0 self-start sm:w-24"
          />
          <div className="min-w-0 flex-1">
            <h3 className="min-w-0 text-sm font-bold leading-snug text-foreground">
              <TextoExpandible texto={local.nombre} />
            </h3>
            <p className="truncate font-mono text-xs text-muted">{local.id}</p>
            <p
              className={`mt-0.5 flex min-w-0 items-start gap-1 text-xs ${ubicado ? "text-muted" : "font-semibold text-amber-700 dark:text-amber-300"}`}
            >
              <IconoPin className="mt-px h-3.5 w-3.5 shrink-0" />
              {local.direccion ? (
                <TextoExpandible texto={local.direccion} />
              ) : (
                <span className="min-w-0">
                  {ubicado ? "Sin dirección en CRD1" : "Sin ubicación cargada"}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="mt-2.5 flex flex-wrap gap-1.5" aria-label="Asignado a">
          {asignaciones.length ? (
            asignaciones.map((a) => (
              <span
                key={a.id}
                title={a.usuario.rol?.descripcion ?? undefined}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 py-0.5 pl-0.5 pr-2.5 text-[11px] font-semibold text-sky-900 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-200"
              >
                <span
                  aria-hidden="true"
                  className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-sky-600 text-[9px] font-bold text-white dark:bg-sky-500 dark:text-sky-950"
                >
                  {iniciales(a.usuario.nombre, a.usuario.apellido)}
                </span>
                <span className="truncate">
                  {a.usuario.nombre} {a.usuario.apellido}
                </span>
              </span>
            ))
          ) : (
            <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300">
              Sin asignar
            </span>
          )}
        </div>

        <div className="mt-3 flex items-center gap-2 border-t border-line/70 pt-2.5">
          <AccionesItinerario
            nombre={local.nombre}
            onInformacion={onInformacion}
            onItinerario={onItinerario}
            onAsignacion={onAsignacion}
          />
        </div>
      </div>
    </article>
  );
}
