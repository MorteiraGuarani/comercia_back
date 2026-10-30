"use client";

import { useId, useState } from "react";
import type { LocalCampo } from "@/types/campo";
import { FotoLocal } from "./ui/foto-local";
import { IconoAlerta, IconoPin } from "./ui/iconos-campo";
import { AccionesItinerario } from "./acciones-itinerario";

// Fila de punto de venta en el celular (Itinerario de supervisores y back
// office): identidad, dirección, quién lo atiende y las acciones en una fila.
// El equipo completo con sus roles va en un desplegable, no en una tarjeta alta.

const iniciales = (nombre: string, apellido: string) =>
  `${nombre[0] ?? ""}${apellido[0] ?? ""}`.toUpperCase();

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
  local: LocalCampo;
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
  const [verEquipo, setVerEquipo] = useState(false);
  const idEquipo = useId();
  const primera = asignaciones[0]?.usuario;
  return (
    <article className="min-w-0 space-y-2.5 rounded-xl border border-line bg-surface-raised p-3 [content-visibility:auto]">
      <div className="flex min-w-0 items-start gap-3">
        <FotoLocal nombre={local.nombre} className="w-14 shrink-0" />
        <div className="min-w-0 flex-1">
          <h3
            title={local.nombre}
            className="line-clamp-2 break-words text-[15px] font-bold leading-snug text-foreground"
          >
            {local.nombre}
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
            <button
              type="button"
              onClick={() => setVerEquipo((actual) => !actual)}
              aria-expanded={verEquipo}
              aria-controls={idEquipo}
              className={`${chip} min-h-8 cursor-pointer border border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-200 dark:hover:bg-sky-900/60`}
            >
              <span className="truncate">
                {primera.nombre} {primera.apellido}
                {asignaciones.length > 1 ? ` +${asignaciones.length - 1}` : ""}
              </span>
              <span aria-hidden="true">{verEquipo ? "▴" : "▾"}</span>
            </button>
          ) : (
            <span className={chipAlerta}>Sin asignar</span>
          ))}
      </div>

      {!sinDetalle && verEquipo && (
        <ul
          id={idEquipo}
          className="min-w-0 space-y-1.5 rounded-lg bg-surface-soft p-2"
          aria-label={`Equipo de ${local.nombre}`}
        >
          {asignaciones.map((a) => (
            <li key={a.id} className="flex min-w-0 items-center gap-2.5">
              <span
                aria-hidden="true"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-800 dark:bg-brand-950 dark:text-brand-200"
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
          ))}
        </ul>
      )}

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
