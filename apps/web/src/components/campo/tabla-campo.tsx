"use client";
import type { ReactNode } from "react";
import { Paginacion } from "@/components/paginacion";
import { PantallaCarga } from "@/components/pantalla-carga";
import { btnGhost, errorBox } from "@/components/ui";
import type { RespuestaPaginada } from "@/types/paginacion";

export function TablaCampo<T extends { id: number }>({
  lista,
  columnas,
  etiqueta,
  acciones,
  tarjetaMovil,
}: {
  lista: {
    datos: RespuestaPaginada<T> | null;
    items: T[];
    cargando: boolean;
    error: string | null;
    setPage: (p: number) => void;
    setLimit: (l: number) => void;
    refrescar: () => void;
  };
  columnas: { titulo: string; valor: (item: T) => ReactNode }[];
  etiqueta: string;
  acciones?: (item: T) => ReactNode;
  tarjetaMovil?: (item: T) => ReactNode;
}) {
  return (
    <div className="w-full min-w-0">
      <PantallaCarga
        visible={lista.cargando}
        mensaje={`Cargando ${etiqueta.toLowerCase()}`}
      />
      {lista.error ? (
        <div className={`${errorBox} my-3`}>
          {lista.error}{" "}
          <button type="button" className={btnGhost} onClick={lista.refrescar}>
            Reintentar
          </button>
        </div>
      ) : null}
      <div className="hidden overflow-x-auto rounded-xl border border-line bg-surface-raised md:block">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{etiqueta}</caption>
          <thead className="bg-surface-soft text-muted">
            <tr>
              {columnas.map((c) => (
                <th key={c.titulo} className="px-4 py-3">
                  {c.titulo}
                </th>
              ))}
              {acciones ? <th className="px-4 py-3">Acciones</th> : null}
            </tr>
          </thead>
          <tbody>
            {lista.items.map((item) => (
              <tr
                key={item.id}
                className="border-t border-line hover:bg-surface-soft"
              >
                {columnas.map((c) => (
                  <td key={c.titulo} className="px-4 py-3">
                    {c.valor(item)}
                  </td>
                ))}
                {acciones ? (
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">{acciones(item)}</div>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="space-y-3 md:hidden" aria-label={etiqueta}>
        {lista.items.map((item) => (
          <li
            key={item.id}
            className="min-w-0"
          >
            {tarjetaMovil ? (
              tarjetaMovil(item)
            ) : (
              <div className="rounded-xl border border-line bg-surface-raised p-4 [content-visibility:auto]">
                <div className="font-semibold">{columnas[0].valor(item)}</div>
                <dl className="mt-2 space-y-2 text-sm">
                  {columnas.slice(1).map((c) => (
                    <div key={c.titulo}>
                      <dt className="text-xs text-muted">{c.titulo}</dt>
                      <dd className="break-words">{c.valor(item)}</dd>
                    </div>
                  ))}
                </dl>
                {acciones ? (
                  <div className="mt-3 flex flex-wrap gap-2">{acciones(item)}</div>
                ) : null}
              </div>
            )}
          </li>
        ))}
      </ul>
      {!lista.cargando && !lista.error && !lista.items.length ? (
        <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">
          No hay registros para esta selección.
        </p>
      ) : null}
      {lista.datos ? (
        <Paginacion
          {...lista.datos}
          onPageChange={lista.setPage}
          onLimitChange={lista.setLimit}
        />
      ) : null}
    </div>
  );
}
