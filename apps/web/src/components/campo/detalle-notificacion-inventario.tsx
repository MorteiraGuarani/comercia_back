"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { DetalleNotificacionInventario } from "@/types/notificacion-inventario";
import {
  estadoVencimiento,
  fechaInventarioLegible,
} from "@/utils/notificacion-inventario";

export function DetalleNotificacionInventario({ id }: { id: number }) {
  const [detalle, setDetalle] = useState<DetalleNotificacionInventario | null>(
    null,
  );
  const [error, setError] = useState("");
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let activo = true;
    const consulta = new AbortController();
    apiFetch<DetalleNotificacionInventario>(
      `/campo/notificaciones/${id}/inventario`,
      { signal: consulta.signal },
    )
      .then((data) => {
        if (activo) setDetalle(data);
      })
      .catch((err: unknown) => {
        if (activo)
          setError(
            err instanceof Error
              ? err.message
              : "No se pudo abrir el inventario",
          );
      });
    return () => {
      activo = false;
      consulta.abort();
    };
  }, [id, intento]);

  if (error)
    return (
      <div className="space-y-3">
        <p
          role="alert"
          className="break-words text-sm text-red-700 dark:text-red-300"
        >
          {error}
        </p>
        <button
          type="button"
          onClick={() => {
            setError("");
            setIntento((n) => n + 1);
          }}
          className="min-h-11 cursor-pointer rounded-lg border border-line px-3 text-sm font-semibold text-foreground hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus dark:border-line dark:text-foreground dark:hover:bg-surface-soft"
        >
          Reintentar
        </button>
      </div>
    );
  if (!detalle)
    return (
      <div
        className="flex min-h-28 items-center justify-center gap-3 text-sm text-muted"
        role="status"
        aria-live="polite"
      >
        <span
          className="h-5 w-5 animate-spin rounded-full border-2 border-current border-r-transparent"
          aria-hidden="true"
        />
        Cargando detalle del inventario…
      </div>
    );

  return (
    <article className="w-full min-w-0 space-y-5 break-words text-foreground dark:text-foreground">
      <div>
        <h3 className="text-lg font-semibold">{detalle.producto.nombre}</h3>
        <p className="mt-1 text-sm text-muted dark:text-muted">
          Producto {detalle.producto.codigo} · Carga #{detalle.id}
        </p>
      </div>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted dark:text-muted">Vencimiento</dt>
          <dd className="mt-1 font-semibold tabular-nums">
            <time dateTime={detalle.vencimiento}>
              {fechaInventarioLegible(detalle.vencimiento)}
            </time>
          </dd>
          <dd className="mt-1 text-muted dark:text-muted">
            {estadoVencimiento(detalle.diasParaVencer)}
          </dd>
        </div>
        <div>
          <dt className="text-muted dark:text-muted">Cantidad cargada</dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums">
            {detalle.cantidad.toLocaleString("es-PY")}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-muted dark:text-muted">Local</dt>
          <dd className="mt-1 font-semibold">{detalle.local.nombre}</dd>
          <dd className="mt-1 text-muted dark:text-muted">
            Código {detalle.local.codigo}
          </dd>
          <dd className="mt-1">
            {detalle.local.direccion || "Sin dirección registrada"}
          </dd>
        </div>
        <div>
          <dt className="text-muted dark:text-muted">Registrado por</dt>
          <dd className="mt-1 font-semibold">{detalle.autor.nombre}</dd>
          <dd className="mt-1 text-muted dark:text-muted">
            {detalle.autor.rol || "Sin rol asignado"}
          </dd>
        </div>
        <div>
          <dt className="text-muted dark:text-muted">Día del inventario</dt>
          <dd className="mt-1 tabular-nums">
            <time dateTime={detalle.fecha}>
              {fechaInventarioLegible(detalle.fecha)}
            </time>
          </dd>
        </div>
        <div>
          <dt className="text-muted dark:text-muted">Carga registrada</dt>
          <dd className="mt-1">
            <time dateTime={detalle.creadaEn}>
              {new Date(detalle.creadaEn).toLocaleString("es-PY", {
                timeZone: "America/Asuncion",
              })}
            </time>
          </dd>
        </div>
        <div>
          <dt className="text-muted dark:text-muted">Última actualización</dt>
          <dd className="mt-1">
            <time dateTime={detalle.actualizadaEn}>
              {new Date(detalle.actualizadaEn).toLocaleString("es-PY", {
                timeZone: "America/Asuncion",
              })}
            </time>
          </dd>
        </div>
      </dl>
    </article>
  );
}
