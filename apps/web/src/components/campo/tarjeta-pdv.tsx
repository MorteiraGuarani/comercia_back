"use client";

import { BotonEditar } from "@/components/boton-editar";
import type { LocalCampo } from "@/types/campo";
import { BotonEliminarCampo } from "./boton-eliminar-campo";
import { FotoLocal } from "./ui/foto-local";
import { IconoPin, IconoPlanificacion } from "./ui/iconos-campo";

// Tarjeta de punto de venta (vista celular de PDV y rutas): franja y estado de
// color, imagen del local, dirección y quién lo atiende.

const iniciales = (nombre: string, apellido: string) =>
  `${nombre[0] ?? ""}${apellido[0] ?? ""}`.toUpperCase();

export function TarjetaPdv({
  local,
  ocupado,
  onEditar,
  onRuta,
  onEliminar,
}: {
  local: LocalCampo;
  ocupado: boolean;
  /** Sin onEditar/onEliminar la tarjeta queda en solo lectura. */
  onEditar?: () => void;
  onRuta: () => void;
  onEliminar?: () => void;
}) {
  const asignaciones = local.asignaciones ?? [];
  return (
    <article className="relative overflow-hidden rounded-xl border border-line bg-surface-raised shadow-[0_2px_8px_rgba(var(--warm-shadow),0.06)] [content-visibility:auto]">
      <span
        aria-hidden="true"
        className={`absolute inset-y-0 left-0 w-1 ${local.activo ? "bg-emerald-600 dark:bg-emerald-400" : "bg-stone-400 dark:bg-stone-500"}`}
      />
      <div className="p-3 pl-4">
        <div className="flex min-w-0 items-start gap-3">
          {/* Misma imagen que en Mi Ruta: logo del cliente o ilustración del frente */}
          <FotoLocal
            nombre={local.nombre}
            cliente={local.cliente}
            className="w-20 shrink-0 self-start sm:w-24"
          />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-start justify-between gap-2">
              <h3 className="min-w-0 break-words text-sm font-bold leading-snug text-foreground">{local.nombre}</h3>
              <span
                className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                  local.activo
                    ? "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                    : "border-stone-300 bg-stone-100 text-stone-700 dark:border-stone-700 dark:bg-stone-800/70 dark:text-stone-200"
                }`}
              >
                {local.activo ? "Activo" : "Inactivo"}
              </span>
            </div>
            {local.cliente ? (
              <p className="truncate text-xs font-semibold text-brand-700 dark:text-brand-200">{local.cliente.nombre}</p>
            ) : (
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">Sin cliente</p>
            )}
            <p className="mt-0.5 flex min-w-0 items-start gap-1 text-xs text-muted">
              <IconoPin className="mt-px h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 break-words">{local.direccion || "Sin dirección cargada"}</span>
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
                <span aria-hidden="true" className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-sky-600 text-[9px] font-bold text-white dark:bg-sky-500 dark:text-sky-950">
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
          {onEditar ? (
            <BotonEditar onClick={onEditar} etiqueta={`Editar local ${local.nombre}`} modo="texto" className="flex-1" />
          ) : null}
          <button
            type="button"
            onClick={onRuta}
            className="inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-brand-200 bg-brand-50 px-3 text-sm font-semibold text-brand-800 transition-colors hover:border-brand-500 hover:bg-brand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus dark:border-brand-800 dark:bg-brand-950/50 dark:text-brand-100 dark:hover:bg-brand-900"
          >
            <IconoPlanificacion className="h-4 w-4" />
            Ruta
          </button>
          {onEliminar ? (
            <BotonEliminarCampo onClick={onEliminar} etiqueta={`Eliminar local ${local.nombre}`} disabled={ocupado} />
          ) : null}
        </div>
      </div>
    </article>
  );
}
