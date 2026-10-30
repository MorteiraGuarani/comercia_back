"use client";

import type { LocalCampo } from "@/types/campo";
import { FotoLocal } from "./ui/foto-local";
import { IconoAlerta, IconoPin } from "./ui/iconos-campo";
import { AccionesItinerario } from "./acciones-itinerario";

// Fila de punto de venta en el celular (Itinerario de supervisores y back
// office): identidad, dirección, quién lo atiende y las acciones en una fila.

const chip =
  "inline-flex max-w-full items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold";
const chipAlerta = `${chip} bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300`;

export function TarjetaPdv({
  local,
  onInformacion,
  onItinerario,
  onAsignacion,
  sinDetalle = false,
  distancia = null,
}: {
  local: LocalCampo & { alias?: string };
  onInformacion: () => void;
  onItinerario: () => void;
  onAsignacion: () => void;
  /** Supervisores: sin dirección ni a cargo (ya filtran por la persona). */
  sinDetalle?: boolean;
  /** Distancia desde el teléfono, ya formateada ("2.3 km"). */
  distancia?: string | null;
}) {
  const asignaciones = local.asignaciones ?? [];
  const ubicado = local.latitud !== null && local.longitud !== null;
  const primera = asignaciones[0]?.usuario;
  const titulo = local.alias ? `${local.nombre} - ${local.alias}` : local.nombre;
  return (
    <article className="min-w-0 space-y-2.5 rounded-xl border border-line bg-surface-raised p-3 [content-visibility:auto]">
      <div className="flex min-w-0 items-start gap-3">
        <FotoLocal nombre={local.nombre} className="w-14 shrink-0" />
        <div className="min-w-0 flex-1">
          <h3
            title={titulo}
            className="line-clamp-2 break-words text-[15px] font-bold leading-snug text-foreground"
          >
            {titulo}
          </h3>
          <p className="truncate font-mono text-xs text-muted">{local.id}</p>
        </div>
      </div>

      {!sinDetalle && (
        <p className="flex min-w-0 items-start gap-1.5 text-sm text-foreground">
          <IconoPin className="mt-0.5 h-4 w-4 shrink-0 text-accent-ink" />
          <span className={`line-clamp-2 break-words ${local.direccion ? "" : "text-muted"}`}>
            {local.direccion || "Sin dirección en CRD1"}
          </span>
        </p>
      )}

      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        {!ubicado ? (
          <span className={chipAlerta}>
            <IconoAlerta className="h-3.5 w-3.5 shrink-0" />
            Sin ubicación
          </span>
        ) : distancia ? (
          <span className={`${chip} bg-brand-50 text-brand-800 dark:bg-brand-950/60 dark:text-brand-200`}>
            <IconoPin className="h-3.5 w-3.5 shrink-0" />A {distancia} de vos
          </span>
        ) : null}
        {!sinDetalle &&
          (primera ? (
            // El equipo completo con roles está en el botón Equipo.
            <span className="ml-auto min-w-0 truncate text-sm font-semibold text-sky-700 dark:text-sky-300">
              {primera.nombre} {primera.apellido}
              {asignaciones.length > 1 ? ` +${asignaciones.length - 1}` : ""}
            </span>
          ) : (
            <span className={`${chipAlerta} ml-auto`}>Sin asignar</span>
          ))}
      </div>

      <AccionesItinerario
        nombre={local.nombre}
        variante="tarjeta"
        onInformacion={onInformacion}
        onItinerario={onItinerario}
        onAsignacion={onAsignacion}
      />
    </article>
  );
}
