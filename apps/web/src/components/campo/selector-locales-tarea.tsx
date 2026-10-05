"use client";
import { useState } from "react";
import { SelectorPaginado } from "@/components/selector-paginado";
import { Paginacion } from "@/components/paginacion";

export function SelectorLocalesTarea({
  ids,
  nombres,
  onChange,
}: {
  ids: number[];
  nombres: Record<number, string>;
  onChange: (ids: number[], nombres: Record<number, string>) => void;
}) {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(7);
  const [revision, setRevision] = useState(0);
  const pagina = Math.min(page, Math.max(1, Math.ceil(ids.length / limit)));
  return (
    <div className="space-y-2 rounded-xl border border-line bg-surface-raised p-3">
      <SelectorPaginado
        key={revision}
        url="/campo/locales"
        etiqueta="Agregar local"
        buscable
        value=""
        onChange={() => undefined}
        onSeleccionar={(local) => {
          if (!ids.includes(local.id))
            onChange([...ids, local.id], {
              ...nombres,
              [local.id]: local.nombre ?? `Local ${local.id}`,
            });
          setRevision((r) => r + 1);
        }}
        vacio="Buscá un local de la empresa"
      />
      <p className="text-xs text-muted">
        {ids.length} locales seleccionados. Los horarios y tareas de cada equipo
        siguen separados.
      </p>
      <ul aria-label="Locales seleccionados" className="divide-y divide-line">
        {ids.slice((pagina - 1) * limit, pagina * limit).map((id) => (
          <li
            key={id}
            className="flex min-h-11 items-center justify-between gap-2 py-1 text-sm text-foreground"
          >
            <span className="min-w-0 break-words">
              {nombres[id] ?? `Local ${id}`}
            </span>
            <button
              type="button"
              aria-label={`Quitar ${nombres[id] ?? `local ${id}`}`}
              className="min-h-11 shrink-0 rounded-md px-3 text-red-700 hover:bg-surface-soft dark:text-red-300"
              onClick={() =>
                onChange(
                  ids.filter((x) => x !== id),
                  nombres,
                )
              }
            >
              Quitar
            </button>
          </li>
        ))}
      </ul>
      {ids.length > 7 ? (
        <Paginacion
          page={pagina}
          limit={limit}
          total={ids.length}
          totalPages={Math.max(1, Math.ceil(ids.length / limit))}
          onPageChange={setPage}
          onLimitChange={setLimit}
        />
      ) : null}
    </div>
  );
}
