"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { usePanel } from "@/components/panel/contexto";
import { Modal } from "@/components/modal";
import { PantallaCarga } from "@/components/pantalla-carga";
import { Paginacion } from "@/components/paginacion";
import { useToast } from "@/components/toast/toast-provider";
import { btnGhost, btnPrimary, errorBox } from "@/components/ui";
import { TopBar } from "./ui/top-bar";
import { SelectorItemInventario } from "./selector-item-inventario";
import { useCatalogoInventario } from "@/hooks/use-catalogo-inventario";
import {
  agregarElegido,
  idsElegidos,
  listarElegidos,
  quitarElegido,
} from "@/lib/inventario-db";
import { formatoFechaHora } from "@/utils/fechas";
import { mensajeError } from "@/utils/error";
import { detalleListaPrecio, nombreListaPrecio } from "@/utils/inventario";
import type { ItemInventario } from "@/types/inventario";

const SIN_ELEGIDOS = new Set<string>();

export function InventarioPanel() {
  const { usuario } = usePanel();
  const { mostrarToast } = useToast();
  const usuarioId = usuario.id;
  const empresaId = usuario.empresa.id;
  const catalogo = useCatalogoInventario(empresaId);
  const [detalleAbierto, setDetalleAbierto] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(7);
  const elegidos = useLiveQuery(
    () => listarElegidos(usuarioId, empresaId, page, limit).catch(() => null),
    [usuarioId, empresaId, page, limit],
  );
  const ids =
    useLiveQuery(
      () => idsElegidos(usuarioId, empresaId).catch(() => SIN_ELEGIDOS),
      [usuarioId, empresaId],
    ) ?? SIN_ELEGIDOS;

  function avisarError(error: unknown, mensaje: string) {
    mostrarToast({ tipo: "error", clave: "inventario-elegidos", mensaje: mensajeError(error, mensaje) });
  }
  function agregar(item: ItemInventario) {
    agregarElegido(usuarioId, empresaId, item)
      .then(() => setPage(1))
      .catch((e: unknown) => avisarError(e, "No se pudo guardar el artículo en este equipo"));
  }
  function quitar(item: ItemInventario) {
    quitarElegido(usuarioId, item.id).catch((e: unknown) =>
      avisarError(e, "No se pudo quitar el artículo"),
    );
  }

  const sinCopia = !catalogo.leyendo && !catalogo.catalogo;
  // Punto de estado del botón: rojo si falló, ámbar sin conexión o sin copia.
  const tonoEstado =
    catalogo.error || catalogo.errorAlmacenamiento
      ? "bg-red-600 dark:bg-red-400"
      : !catalogo.enLinea || sinCopia
        ? "bg-amber-500 dark:bg-amber-400"
        : null;
  const motivoSinCopia = catalogo.errorAlmacenamiento
    ? "Este navegador no permite guardar artículos"
    : catalogo.error
      ? "No se pudieron descargar los artículos"
      : catalogo.enLinea
      ? "Descargando artículos…"
      : "Conectate para descargar los artículos";

  return (
    <div className="min-w-0 w-full">
      <PantallaCarga
        visible={catalogo.actualizando && (catalogo.bloqueante || !catalogo.catalogo)}
        mensaje="Descargando artículos"
      />
      <TopBar
        title="Inventario"
        subtitle="Elegí los artículos con los que vas a trabajar. Quedan guardados en este equipo, también sin conexión."
        right={
          <button
            type="button"
            className="relative grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-xl border border-control-line bg-surface-raised text-foreground transition-colors hover:border-brand-500 hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus dark:border-control-line dark:bg-surface-raised dark:text-foreground dark:hover:bg-surface-soft"
            aria-label="Artículos guardados en este equipo"
            title="Artículos guardados en este equipo"
            aria-haspopup="dialog"
            onClick={() => setDetalleAbierto(true)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
              <ellipse cx="12" cy="5.5" rx="7.5" ry="2.75" />
              <path d="M4.5 5.5v6.5c0 1.5 3.4 2.75 7.5 2.75s7.5-1.25 7.5-2.75V5.5" />
              <path d="M4.5 12v6.5c0 1.5 3.4 2.75 7.5 2.75s7.5-1.25 7.5-2.75V12" />
            </svg>
            {tonoEstado ? (
              <span className={`absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-surface-raised ${tonoEstado}`} aria-hidden />
            ) : null}
          </button>
        }
      />
      <div className="mx-auto w-full min-w-0 max-w-4xl space-y-4 px-4 py-5 sm:px-6 lg:px-8">
        <SelectorItemInventario
          empresaId={empresaId}
          elegidos={ids}
          version={catalogo.catalogo?.sincronizadoEn ?? 0}
          disabled={!catalogo.catalogo}
          placeholder={catalogo.catalogo ? undefined : motivoSinCopia}
          onElegir={agregar}
        />

        <section
          aria-labelledby="inventario-elegidos"
          className="min-w-0 rounded-2xl border border-line bg-surface-raised p-4"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="inventario-elegidos" className="text-base font-semibold text-foreground">
              Artículos elegidos
            </h2>
            {elegidos ? (
              <span className="text-xs text-muted [font-variant-numeric:tabular-nums]">
                {elegidos.total} {elegidos.total === 1 ? "artículo" : "artículos"}
              </span>
            ) : null}
          </div>
          {elegidos === undefined ? (
            <p className="mt-3 text-sm text-muted">Cargando artículos elegidos…</p>
          ) : elegidos === null ? (
            <p className={`${errorBox} mt-3`}>No se pudieron leer los artículos elegidos en este equipo.</p>
          ) : elegidos.total === 0 ? (
            <p className="mt-3 text-sm text-muted">
              Todavía no elegiste artículos. Buscalos arriba por código o nombre.
            </p>
          ) : (
            <>
              {/* Celular: lista compacta; desde md, la tabla. */}
              <ul aria-label="Artículos elegidos" className="mt-2 divide-y divide-line md:hidden">
                {elegidos.items.map((item) => (
                  <li key={item.id} className="flex min-w-0 items-center gap-3 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block break-words text-[13px] font-semibold text-foreground">
                        {item.itemname}
                      </span>
                      <span className="mt-0.5 block break-words text-[11px] text-muted [font-variant-numeric:tabular-nums]">
                        <span className="font-mono">{item.itemcode}</span> · {detalleListaPrecio(item)}
                      </span>
                    </span>
                    <button
                      type="button"
                      className="min-h-10 shrink-0 cursor-pointer whitespace-nowrap rounded-lg border border-line bg-surface-raised px-3 text-xs font-semibold text-foreground transition-colors hover:border-red-500 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus dark:hover:text-red-300"
                      aria-label={`Quitar ${item.itemname} (${nombreListaPrecio(item)})`}
                      onClick={() => quitar(item)}
                    >
                      Quitar
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-3 hidden w-full min-w-0 overflow-x-auto md:block">
                <table className="w-full text-left text-sm text-foreground">
                  <thead className="border-b border-line bg-surface-soft text-xs uppercase text-muted">
                    <tr>
                      <th className="p-3">Código</th>
                      <th className="p-3">Artículo</th>
                      <th className="p-3 text-right">
                        <span className="sr-only">Acción</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {elegidos.items.map((item) => (
                      <tr key={item.id} className="border-b border-line last:border-0">
                        <td className="whitespace-nowrap p-3 align-middle font-mono text-xs text-muted">
                          {item.itemcode}
                        </td>
                        <td className="min-w-0 p-3 align-middle">
                          <span className="block break-words">{item.itemname}</span>
                          <span className="block break-words text-xs text-muted [font-variant-numeric:tabular-nums]">
                            {detalleListaPrecio(item)}
                          </span>
                        </td>
                        <td className="p-3 text-right align-middle">
                          <button
                            type="button"
                            className={`${btnGhost} whitespace-nowrap hover:border-red-500 hover:text-red-700 dark:hover:text-red-300`}
                            aria-label={`Quitar ${item.itemname} (${nombreListaPrecio(item)})`}
                            onClick={() => quitar(item)}
                          >
                            Quitar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Paginacion
                page={elegidos.page}
                limit={elegidos.limit}
                total={elegidos.total}
                totalPages={elegidos.totalPages}
                onPageChange={setPage}
                onLimitChange={(cantidad) => {
                  setLimit(cantidad);
                  setPage(1);
                }}
              />
            </>
          )}
        </section>
      </div>

      <Modal
        titulo="Artículos guardados"
        abierto={detalleAbierto}
        onCerrar={() => setDetalleAbierto(false)}
        pie={
          <div className="flex flex-wrap justify-end gap-2 pt-3">
            <button type="button" className={`${btnGhost} whitespace-nowrap`} onClick={() => setDetalleAbierto(false)}>
              Cerrar
            </button>
            <button
              type="button"
              className={`${btnPrimary} whitespace-nowrap`}
              disabled={!catalogo.enLinea || catalogo.actualizando || !!catalogo.errorAlmacenamiento}
              onClick={() => {
                setDetalleAbierto(false);
                void catalogo.actualizar(true);
              }}
            >
              {catalogo.actualizando ? "Actualizando…" : "Actualizar ahora"}
            </button>
          </div>
        }
      >
        <dl className="grid gap-3 text-sm text-foreground">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted">Artículos en este equipo</dt>
            <dd className="font-semibold [font-variant-numeric:tabular-nums]">
              {catalogo.catalogo ? catalogo.catalogo.articulos.toLocaleString("es-PY") : "Ninguno"}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted">Precios por lista</dt>
            <dd className="font-semibold [font-variant-numeric:tabular-nums]">
              {catalogo.catalogo ? catalogo.catalogo.total.toLocaleString("es-PY") : "Ninguno"}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted">Última actualización</dt>
            <dd className="text-right">
              {catalogo.catalogo
                ? formatoFechaHora(new Date(catalogo.catalogo.sincronizadoEn).toISOString())
                : "Todavía no se descargaron"}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted">Conexión</dt>
            <dd className={catalogo.enLinea ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"}>
              {catalogo.enLinea ? "En línea" : "Sin conexión"}
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-muted">
          Se actualizan solos una vez por día cuando hay conexión. Sin conexión seguís usando la última copia.
        </p>
        {catalogo.error || catalogo.errorAlmacenamiento ? (
          <p className={`${errorBox} mt-3`}>{catalogo.errorAlmacenamiento ?? catalogo.error}</p>
        ) : null}
      </Modal>
    </div>
  );
}
