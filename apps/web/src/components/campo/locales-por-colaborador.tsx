"use client";

import { Paginacion } from "@/components/paginacion";
import { useListaCampo } from "@/hooks/use-lista-campo";
import type { ColaboradorLocales } from "@/types/campo";

// Agrupador de Administración: cada colaborador con la cantidad de locales que
// atiende hoy. "Ver locales" filtra la lista; "Intercambiar" abre el traspaso.

const iniciales = (nombre: string) =>
  nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0])
    .join("")
    .toUpperCase();
const botonFila =
  "min-h-11 cursor-pointer whitespace-nowrap rounded-lg border border-line bg-surface-raised px-3 text-sm font-semibold text-foreground hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus";

export function LocalesPorColaborador({
  buscar,
  onVer,
  onIntercambiar,
}: {
  buscar: string;
  onVer: (colaborador: ColaboradorLocales) => void;
  onIntercambiar: (colaborador: ColaboradorLocales) => void;
}) {
  const lista = useListaCampo<ColaboradorLocales>(
    `/campo/locales/colaboradores${buscar.trim() ? `?buscar=${encodeURIComponent(buscar.trim())}` : ""}`,
    0,
    7,
  );
  const total = lista.datos?.total ?? 0;
  const acciones = (c: ColaboradorLocales) => (
    <>
      <button
        type="button"
        onClick={() => onVer(c)}
        aria-label={`Ver locales de ${c.nombre}`}
        className={botonFila}
      >
        Ver locales
      </button>
      <button
        type="button"
        onClick={() => onIntercambiar(c)}
        aria-label={`Pasar o intercambiar locales de ${c.nombre}`}
        className={botonFila}
      >
        Intercambiar
      </button>
    </>
  );

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface-raised shadow-xs">
      {lista.error ? (
        <div role="alert" className="space-y-3 px-4 py-12 text-center">
          <p className="text-sm text-red-700 dark:text-red-300">{lista.error}</p>
          <button type="button" onClick={lista.refrescar} className={botonFila}>
            Reintentar
          </button>
        </div>
      ) : lista.cargando && !lista.items.length ? (
        <p className="py-16 text-center font-mono text-xs text-muted">
          Cargando colaboradores…
        </p>
      ) : !lista.items.length ? (
        <p className="px-4 py-12 text-center text-sm text-muted">
          {buscar
            ? "Nadie coincide con esa búsqueda."
            : "Nadie de tu equipo atiende locales hoy."}
        </p>
      ) : (
        <>
          <ul
            className="grid gap-2.5 p-2.5 md:hidden"
            aria-label="Colaboradores y sus locales"
          >
            {lista.items.map((c) => (
              <li
                key={c.id}
                className="min-w-0 space-y-2.5 rounded-xl border border-line p-3 [content-visibility:auto]"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-800 dark:bg-brand-950 dark:text-brand-200"
                  >
                    {iniciales(c.nombre)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-bold text-foreground">
                      {c.nombre}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {c.descripcion} · {c.codigo}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-md bg-surface-soft px-2 py-1 font-mono text-xs font-bold text-foreground">
                    {c.locales}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">{acciones(c)}</div>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-line bg-surface-soft text-[11px] font-bold uppercase tracking-wider text-muted">
                  <th className="px-3.5 py-2.5">Colaborador</th>
                  <th className="px-3.5 py-2.5">Rol</th>
                  <th className="px-3.5 py-2.5">Código</th>
                  <th className="px-3.5 py-2.5 text-right">Locales hoy</th>
                  <th className="px-3.5 py-2.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-xs">
                {lista.items.map((c) => (
                  <tr key={c.id} className="transition-colors hover:bg-surface-soft">
                    <td className="px-3.5 py-2.5">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span
                          aria-hidden="true"
                          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-800 dark:bg-brand-950 dark:text-brand-200"
                        >
                          {iniciales(c.nombre)}
                        </span>
                        <span className="text-sm font-semibold text-foreground">
                          {c.nombre}
                        </span>
                      </div>
                    </td>
                    <td className="px-3.5 py-2.5 text-muted">{c.descripcion}</td>
                    <td className="px-3.5 py-2.5 font-mono text-muted">{c.codigo}</td>
                    <td className="px-3.5 py-2.5 text-right font-mono text-sm font-bold text-foreground">
                      {c.locales}
                    </td>
                    <td className="whitespace-nowrap px-3.5 py-2.5">
                      <div className="flex justify-end gap-2">{acciones(c)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {!lista.error && total > 0 && (
        <div className="flex justify-end border-t border-line bg-surface-soft px-4 pb-3">
          <div className="w-full min-w-0 sm:w-auto">
            <Paginacion
              page={lista.page}
              totalPages={lista.datos?.totalPages ?? 1}
              total={total}
              limit={lista.limit}
              onPageChange={lista.setPage}
              onLimitChange={lista.setLimit}
            />
          </div>
        </div>
      )}
    </div>
  );
}
