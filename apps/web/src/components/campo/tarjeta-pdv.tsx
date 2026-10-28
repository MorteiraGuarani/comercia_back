"use client";

import type { LocalCampo } from "@/types/campo";
import { FotoLocal } from "./ui/foto-local";
import { IconoAlerta, IconoPin } from "./ui/iconos-campo";
import { AccionesItinerario } from "./acciones-itinerario";
import { TextoExpandible } from "./ui/texto-expandible";

// Tarjeta de punto de venta en el celular (Itinerario de supervisores y back
// office): ilustración y nombre, dirección, quién lo atiende y tres acciones.

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
    <article className="min-w-0 space-y-3 rounded-2xl border border-line bg-surface-raised p-3 shadow-[0_2px_8px_rgba(var(--warm-shadow),0.06)] [content-visibility:auto]">
      <div className="flex min-w-0 items-center gap-3">
        <FotoLocal nombre={local.nombre} className="w-28 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <h3
            title={local.nombre}
            className="line-clamp-2 break-words text-[15px] font-bold leading-snug text-foreground"
          >
            {local.nombre}
          </h3>
          <p className="mt-0.5 truncate font-mono text-xs text-muted">{local.id}</p>
        </div>
      </div>

      <div className="min-w-0 space-y-1.5">
        <p className="flex min-w-0 items-center gap-1.5 text-sm text-foreground">
          <IconoPin className="h-4 w-4 shrink-0 text-accent-ink" />
          {local.direccion ? (
            <TextoExpandible texto={local.direccion} />
          ) : (
            <span className="text-muted">Sin dirección en CRD1</span>
          )}
        </p>
        {!ubicado ? (
          <span className="ml-5 inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
            <IconoAlerta className="h-3.5 w-3.5 shrink-0" />
            Sin ubicación cargada
          </span>
        ) : null}
      </div>

      <ul className="min-w-0 space-y-1.5 border-t border-line pt-2.5" aria-label="Asignado a">
        {asignaciones.length ? (
          asignaciones.map((a) => (
            <li key={a.id} className="flex min-w-0 items-center gap-2.5">
              <span
                aria-hidden="true"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-800 dark:bg-brand-950 dark:text-brand-200"
              >
                {iniciales(a.usuario.nombre, a.usuario.apellido)}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                {a.usuario.nombre} {a.usuario.apellido}
              </span>
              <span className="shrink-0 text-xs text-muted">
                {a.usuario.rol?.descripcion ?? "Asignado"}
              </span>
            </li>
          ))
        ) : (
          <li className="flex min-w-0 items-center gap-2.5">
            <span
              aria-hidden="true"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-dashed border-amber-400 text-amber-700 dark:border-amber-700 dark:text-amber-300"
            >
              ?
            </span>
            <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              Sin asignar
            </span>
          </li>
        )}
      </ul>

      <div className="border-t border-line pt-3">
        <AccionesItinerario
          nombre={local.nombre}
          variante="tarjeta"
          onInformacion={onInformacion}
          onItinerario={onItinerario}
          onAsignacion={onAsignacion}
        />
      </div>
    </article>
  );
}
