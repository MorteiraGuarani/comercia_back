"use client";

import type { LocalCampo } from "@/types/campo";
import { IconoPin } from "./ui/iconos-campo";
import { AccionesItinerario } from "./acciones-itinerario";
import { TextoExpandible } from "./ui/texto-expandible";

// Tarjeta de punto de venta (vista celular de PDV y rutas): nombre, CardCode,
// ubicación en OCRD y quién lo atiende, en poco alto.

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
      {/* Compacta para el celular: nombre y código, dirección, y asignados con las acciones. */}
      <div className="space-y-1.5 py-2.5 pl-4 pr-2.5">
        <div className="flex min-w-0 items-baseline gap-2">
          <h3 className="min-w-0 flex-1 text-sm font-bold leading-snug text-foreground">
            <TextoExpandible texto={local.nombre} />
          </h3>
          <span className="shrink-0 font-mono text-[11px] text-muted">{local.id}</span>
        </div>
        <p
          className={`flex min-w-0 items-center gap-1 text-xs ${ubicado ? "text-muted" : "font-semibold text-amber-700 dark:text-amber-300"}`}
        >
          <IconoPin className="h-3.5 w-3.5 shrink-0" />
          {local.direccion ? (
            <TextoExpandible texto={local.direccion} />
          ) : (
            <span className="min-w-0 truncate">
              {ubicado ? "Sin dirección en CRD1" : "Sin ubicación cargada"}
            </span>
          )}
        </p>
        <div className="flex min-w-0 items-center gap-2 pt-0.5">
          <div className="flex min-w-0 flex-1 flex-wrap gap-1" aria-label="Asignado a">
            {asignaciones.length ? (
              asignaciones.map((a) => (
                <span
                  key={a.id}
                  title={`${a.usuario.nombre} ${a.usuario.apellido}${a.usuario.rol?.descripcion ? ` · ${a.usuario.rol.descripcion}` : ""}`}
                  className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-full border border-sky-200 bg-sky-50 py-0.5 pl-0.5 pr-2 text-[11px] font-semibold text-sky-900 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-200"
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
              <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300">
                Sin asignar
              </span>
            )}
          </div>
          <div className="shrink-0">
            <AccionesItinerario
              nombre={local.nombre}
              onInformacion={onInformacion}
              onItinerario={onItinerario}
              onAsignacion={onAsignacion}
            />
          </div>
        </div>
      </div>
    </article>
  );
}
