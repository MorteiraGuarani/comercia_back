"use client";

import { Fragment, useState, type FormEvent } from "react";
import { IconoChevronAbajo } from "@/components/campo/ui/iconos-campo";
import { Paginacion } from "@/components/paginacion";
import { SkeletonFilas } from "@/components/skeleton";
import { btnGhost, btnPrimary, errorBox, inputBase, labelBase } from "@/components/ui";
import { useListaCampo } from "@/hooks/use-lista-campo";
import type { AccionAuditoria, FiltrosAuditoria, RegistroAuditoria } from "@/types/auditoria";
import {
  ACCIONES_AUDITORIA,
  consultaAuditoria,
  ENTIDADES_AUDITORIA,
  textoAccion,
  valorAuditoria,
} from "@/utils/auditoria";
import { formatoFechaHora } from "@/utils/fechas";

const SIN_FILTROS: FiltrosAuditoria = { desde: "", hasta: "", usuario: "", entidad: "", accion: "" };

const ESTILO_ACCION: Record<AccionAuditoria, string> = {
  CREAR:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300",
  ASIGNAR:
    "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-300",
  MODIFICAR:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300",
  QUITAR:
    "border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-900 dark:bg-orange-950/50 dark:text-orange-300",
  ELIMINAR:
    "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300",
};

const FOCO = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus";

function Accion({ r }: { r: RegistroAuditoria }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold ${ESTILO_ACCION[r.accion] ?? ""}`}
    >
      {textoAccion(r.accion)}
    </span>
  );
}

function Quien({ r }: { r: RegistroAuditoria }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-sm font-semibold text-foreground">{r.usuarioNombre ?? "Sin sesión"}</p>
      <p className="truncate text-[11px] text-muted">{r.usuarioRol ?? "Sin rol"}</p>
    </div>
  );
}

function Entidad({ r }: { r: RegistroAuditoria }) {
  return (
    <div className="min-w-0">
      <p className="break-words text-sm text-foreground">{r.etiqueta ?? `${r.entidad} ${r.entidadId}`}</p>
      <p className="truncate text-[11px] text-muted">
        {[`${r.entidad} #${r.entidadId}`, r.empresaNombre].filter(Boolean).join(" · ")}
      </p>
    </div>
  );
}

/** Antes y después de cada campo que cambió. */
function Cambios({ r, id }: { r: RegistroAuditoria; id: string }) {
  const campos = Object.entries(r.cambios);
  return (
    <div id={id} className="min-w-0 border-t border-line bg-surface-soft px-4 py-3">
      {campos.length ? (
        <dl className="space-y-2">
          {campos.map(([campo, { antes, despues }]) => (
            <div key={campo} className="grid min-w-0 grid-cols-1 gap-1 sm:grid-cols-[minmax(0,12rem)_1fr_1fr] sm:gap-3">
              <dt className="break-words font-mono text-xs font-semibold text-foreground">{campo}</dt>
              <dd className="min-w-0 break-words text-xs text-red-700 dark:text-red-300">
                <span className="text-muted">Antes: </span>
                {valorAuditoria(antes)}
              </dd>
              <dd className="min-w-0 break-words text-xs text-emerald-700 dark:text-emerald-300">
                <span className="text-muted">Después: </span>
                {valorAuditoria(despues)}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-xs text-muted">Sin detalle de campos.</p>
      )}
    </div>
  );
}

/** Superadmin y Admin TI: quién cambió qué en el backoffice, con el antes y el después. */
export function AuditoriaPanel() {
  const [filtros, setFiltros] = useState<FiltrosAuditoria>(SIN_FILTROS);
  const [aplicados, setAplicados] = useState<FiltrosAuditoria>(SIN_FILTROS);
  const [abierto, setAbierto] = useState<number | null>(null);
  const consulta = consultaAuditoria(aplicados);
  const lista = useListaCampo<RegistroAuditoria>(`/admin/auditoria${consulta ? `?${consulta}` : ""}`, 0, 7);
  const cambiar = (c: Partial<FiltrosAuditoria>) => setFiltros((f) => ({ ...f, ...c }));
  const aplicar = (f: FiltrosAuditoria) => {
    setAplicados(f);
    setAbierto(null);
    lista.setPage(1);
    lista.refrescar();
  };
  const buscar = (e: FormEvent) => {
    e.preventDefault();
    aplicar(filtros);
  };
  const alternar = (id: number) => setAbierto((a) => (a === id ? null : id));

  return (
    <section className="min-w-0 w-full space-y-4" aria-label="Log de auditoría">
      <form onSubmit={buscar} className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className={labelBase}>
          Desde
          <input type="date" className={inputBase} value={filtros.desde} max={filtros.hasta || undefined} onChange={(e) => cambiar({ desde: e.target.value })} />
        </label>
        <label className={labelBase}>
          Hasta
          <input type="date" className={inputBase} value={filtros.hasta} min={filtros.desde || undefined} onChange={(e) => cambiar({ hasta: e.target.value })} />
        </label>
        <label className={labelBase}>
          Usuario
          <input type="search" className={inputBase} value={filtros.usuario} maxLength={100} placeholder="Nombre de quien hizo el cambio" onChange={(e) => cambiar({ usuario: e.target.value })} />
        </label>
        <label className={labelBase}>
          Entidad
          <select className={inputBase} value={filtros.entidad} onChange={(e) => cambiar({ entidad: e.target.value })}>
            <option value="">Todas</option>
            {ENTIDADES_AUDITORIA.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </label>
        <label className={labelBase}>
          Acción
          <select className={inputBase} value={filtros.accion} onChange={(e) => cambiar({ accion: e.target.value as FiltrosAuditoria["accion"] })}>
            <option value="">Todas</option>
            {ACCIONES_AUDITORIA.map((a) => (
              <option key={a.valor} value={a.valor}>
                {a.texto}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-5">
          <button type="submit" className={`${btnPrimary} whitespace-nowrap`}>
            Buscar
          </button>
          <button
            type="button"
            className={`${btnGhost} whitespace-nowrap`}
            onClick={() => {
              setFiltros(SIN_FILTROS);
              aplicar(SIN_FILTROS);
            }}
          >
            Limpiar
          </button>
          <span className="whitespace-nowrap rounded-lg border border-line bg-surface-raised px-3 py-2 font-mono text-xs font-semibold text-foreground">
            {lista.datos?.total ?? "—"} registros
          </span>
        </div>
      </form>

      {lista.error ? (
        <div className={errorBox}>
          {lista.error}{" "}
          <button type="button" className={btnGhost} onClick={lista.refrescar}>
            Reintentar
          </button>
        </div>
      ) : null}

      <div className="min-w-0 overflow-hidden rounded-xl border border-line bg-surface-raised">
        {lista.cargando ? (
          <SkeletonFilas etiqueta="Cargando log de auditoría" filas={5} className="px-4 py-3" />
        ) : (
          <>
            <table className="hidden w-full text-left text-sm md:table">
              <caption className="sr-only">Log de auditoría</caption>
              <thead className="bg-surface-soft text-muted">
                <tr>
                  {["Cuándo", "Quién", "Acción", "Registro"].map((t) => (
                    <th key={t} className="px-4 py-3">
                      {t}
                    </th>
                  ))}
                  <th className="w-14">
                    <span className="sr-only">Detalle</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {lista.items.map((r) => {
                  const visible = abierto === r.id;
                  const detalle = `auditoria-detalle-${r.id}`;
                  return (
                    <Fragment key={r.id}>
                      <tr
                        onClick={() => alternar(r.id)}
                        className={`cursor-pointer border-t border-line transition-colors hover:bg-surface-soft ${visible ? "bg-surface-soft" : ""}`}
                      >
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-foreground">{formatoFechaHora(r.creadoEn)}</td>
                        <td className="max-w-56 px-4 py-3">
                          <Quien r={r} />
                        </td>
                        <td className="px-4 py-3">
                          <Accion r={r} />
                        </td>
                        <td className="px-4 py-3">
                          <Entidad r={r} />
                        </td>
                        <td className="px-1">
                          <button
                            type="button"
                            aria-expanded={visible}
                            aria-controls={detalle}
                            aria-label={`${visible ? "Ocultar" : "Ver"} cambios de ${r.etiqueta ?? r.entidad}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              alternar(r.id);
                            }}
                            className={`grid h-11 w-11 cursor-pointer place-items-center rounded-lg text-muted hover:bg-surface-soft ${FOCO}`}
                          >
                            <IconoChevronAbajo className={`h-4 w-4 transition-transform ${visible ? "rotate-180" : ""}`} />
                          </button>
                        </td>
                      </tr>
                      {visible ? (
                        <tr>
                          <td colSpan={5} className="p-0">
                            <Cambios r={r} id={detalle} />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            <ul className="md:hidden" aria-label="Log de auditoría">
              {lista.items.map((r) => {
                const visible = abierto === r.id;
                const detalle = `auditoria-detalle-movil-${r.id}`;
                return (
                  <li key={r.id} className="min-w-0 border-t border-line first:border-t-0 [content-visibility:auto]">
                    <button
                      type="button"
                      aria-expanded={visible}
                      aria-controls={detalle}
                      onClick={() => alternar(r.id)}
                      className={`flex min-h-14 w-full min-w-0 cursor-pointer items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-soft ${visible ? "bg-surface-soft" : ""} ${FOCO}`}
                    >
                      <span className="min-w-0 flex-1 space-y-1">
                        <span className="block break-words text-sm font-semibold text-foreground">
                          {r.etiqueta ?? `${r.entidad} ${r.entidadId}`}
                        </span>
                        <span className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-muted">
                          <Accion r={r} />
                          {r.entidad} · {Object.keys(r.cambios).length} campos
                        </span>
                        <span className="block truncate text-xs text-muted">
                          {r.usuarioNombre ?? "Sin sesión"} ({r.usuarioRol ?? "sin rol"}) · {formatoFechaHora(r.creadoEn)}
                        </span>
                      </span>
                      <IconoChevronAbajo className={`h-4 w-4 shrink-0 text-muted transition-transform ${visible ? "rotate-180" : ""}`} />
                    </button>
                    {visible ? <Cambios r={r} id={detalle} /> : null}
                  </li>
                );
              })}
            </ul>
            {!lista.error && lista.datos?.total === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted">No hay cambios registrados para esta búsqueda.</p>
            ) : null}
          </>
        )}
      </div>
      {lista.datos && lista.datos.total > 0 ? (
        <Paginacion {...lista.datos} onPageChange={lista.setPage} onLimitChange={lista.setLimit} />
      ) : null}
    </section>
  );
}
