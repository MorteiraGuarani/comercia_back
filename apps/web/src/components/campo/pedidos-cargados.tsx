"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { BotonCopiar } from "@/components/boton-copiar";
import { BotonEditar } from "@/components/boton-editar";
import { BotonEliminarCampo } from "@/components/campo/boton-eliminar-campo";
import { DocumentosPedidoModal } from "@/components/campo/documentos-pedido-modal";
import { confirmar } from "@/components/confirmacion/confirmacion-controller";
import { Paginacion } from "@/components/paginacion";
import { PantallaCarga } from "@/components/pantalla-carga";
import { mostrarToast } from "@/components/toast/toast-controller";
import {
  BOTON_FILTRO_COMPACTO,
  SelectorFechaFiltro,
} from "@/components/campo/ui/selector-fecha-filtro";
import { errorBox } from "@/components/ui";
import { useListaCampo } from "@/hooks/use-lista-campo";
import type { EstadoPedido, PedidoResumen } from "@/types/pedido";
import type { PeriodoFiltro } from "@/types/periodo-filtro";
import { fechaEnZonaIso, horaOFechaCorta } from "@/utils/fechas";
import { periodosPedidos, rangoPeriodoInicio } from "@/utils/periodo-inicio";
import { ESTADOS_PEDIDO, guaranies } from "@/utils/pedidos";

function EstadoChip({ pedido }: { pedido: PedidoResumen }) {
  return (
    <div className="flex shrink-0 justify-end">
      <span
        className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-bold ${
          FILTROS_ESTADO.find((f) => f.id === pedido.estado)?.apagado ??
          "border-transparent bg-accent-soft text-accent"
        }`}
      >
        {ESTADOS_PEDIDO.find((e) => e.id === pedido.estado)?.nombre ?? pedido.estado}
      </span>
    </div>
  );
}

// Filtros de la lista: un toque filtra y otro toque en el mismo lo saca.
const FILTROS_ESTADO: {
  id: EstadoPedido;
  nombre: string;
  apagado: string;
  activo: string;
}[] = [
  {
    id: "MIGRADO",
    nombre: "Migrado",
    apagado:
      "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-800/60 dark:bg-sky-950/40 dark:text-sky-200/80",
    activo:
      "border-sky-700 bg-sky-700 text-white dark:border-sky-700 dark:bg-sky-800 dark:text-sky-50",
  },
  {
    id: "CARGADO",
    nombre: "Guardado",
    apagado:
      "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200/80",
    activo:
      "border-emerald-700 bg-emerald-700 text-white dark:border-emerald-700 dark:bg-emerald-800 dark:text-emerald-50",
  },
];

/** Pedidos que cargó el usuario, del más reciente al más viejo. */
export function PedidosCargados({
  onCopiar,
}: {
  onCopiar: (pedido: PedidoResumen) => void;
}) {
  const hoy = fechaEnZonaIso(new Date());
  const [periodo, setPeriodo] = useState<PeriodoFiltro>(
    () => periodosPedidos(hoy)[1],
  );
  const [estado, setEstado] = useState<EstadoPedido | "">("");
  const [abierto, setAbierto] = useState<PedidoResumen | null>(null);
  const [eliminando, setEliminando] = useState(false);

  const { desde, hasta } = rangoPeriodoInicio(periodo, hoy);
  const { datos, error, page, limit, setPage, setLimit, refrescar } =
    useListaCampo<PedidoResumen>(
      `/pedidos?desde=${desde}&hasta=${hasta}${estado ? `&estado=${estado}` : ""}`,
      0,
      7,
    );

  async function eliminar(p: PedidoResumen) {
    if (
      !(await confirmar({
        titulo: "Eliminar pedido",
        mensaje: `¿Eliminar el pedido ${p.numero} de ${p.cliente.nombre}? No se puede deshacer.`,
        textoConfirmar: "Eliminar",
        peligro: true,
      }))
    )
      return;
    setEliminando(true);
    try {
      await apiFetch<null>(`/pedidos/${p.id}`, { method: "DELETE" });
      mostrarToast("exito", `Pedido ${p.numero} eliminado`);
      // Era el último de su página: se vuelve a la anterior.
      if (datos?.items.length === 1 && page > 1) setPage(page - 1);
      else refrescar();
    } catch (e) {
      mostrarToast("error", e instanceof Error ? e.message : "No se pudo eliminar el pedido");
    } finally {
      setEliminando(false);
    }
  }

  return (
    <section className="w-full min-w-0 space-y-3">
      <PantallaCarga visible={eliminando} mensaje="Eliminando pedido" />
      <h2 className="text-sm font-bold text-foreground">Pedidos</h2>
      <div className="flex min-w-0 items-center justify-between gap-1">
        <SelectorFechaFiltro
          valorActual={periodo}
          periodos={periodosPedidos}
          compacto
          onChange={(p) => {
            setPeriodo(p);
            setPage(1);
          }}
        />
        <div role="group" aria-label="Estado" className="flex shrink-0 items-center gap-1">
          {FILTROS_ESTADO.map((e) => (
            <button
              key={e.id}
              type="button"
              aria-pressed={estado === e.id}
              onClick={() => {
                setEstado((actual) => (actual === e.id ? "" : e.id));
                setPage(1);
              }}
              className={`${BOTON_FILTRO_COMPACTO} cursor-pointer whitespace-nowrap rounded-full border font-semibold transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus dark:hover:brightness-125 ${
                estado === e.id ? e.activo : e.apagado
              }`}
            >
              {e.nombre}
            </button>
          ))}
        </div>
      </div>
      {error ? (
        <p className={errorBox}>{error}</p>
      ) : !datos ? (
        <p className="text-sm text-muted">Cargando pedidos…</p>
      ) : !datos.total ? (
        <p className="rounded-2xl border border-line bg-surface-raised p-4 text-center text-sm text-muted">
          No hay pedidos con estos filtros.
        </p>
      ) : (
        <>
          <ul
            aria-label="Pedidos"
            className="divide-y divide-line rounded-2xl border border-line bg-surface-raised md:hidden"
          >
            {datos.items.map((p) => (
              <li key={p.id} className="space-y-1 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 font-semibold text-foreground">
                    {p.cliente.nombre}
                  </p>
                  <EstadoChip pedido={p} />
                </div>
                <p className="text-xs text-muted">
                  {p.numero} · {horaOFechaCorta(p.creadoEn)} · {p.cantidadProductos} productos
                </p>
                <div className="flex items-center justify-between gap-2">
                  <b className="tabular-nums text-foreground">{guaranies(p.total)}</b>
                  <div className="flex items-center gap-1">
                    {p.estado !== "CARGADO" ? (
                      <BotonCopiar
                        modo="texto"
                        etiqueta={`Copiar ${p.numero}`}
                        onClick={() => onCopiar(p)}
                      />
                    ) : null}
                    {p.eliminable ? (
                      <BotonEliminarCampo
                        modo="texto"
                        etiqueta={`Eliminar ${p.numero}`}
                        onClick={() => void eliminar(p)}
                      />
                    ) : null}
                    <BotonEditar
                      modo="texto"
                      etiqueta={`Editar y enviar ${p.numero}`}
                      onClick={() => setAbierto(p)}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto rounded-2xl border border-line bg-surface-raised md:block">
            <table className="w-full text-sm">
              <thead className="bg-surface-soft text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2 font-semibold">Pedido</th>
                  <th className="px-3 py-2 text-right font-semibold">Total</th>
                  <th className="px-3 py-2 text-right font-semibold">Estado</th>
                  <th className="px-3 py-2 text-right font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {datos.items.map((p) => (
                  <tr key={p.id}>
                    <td className="px-3 py-2">
                      <p className="font-semibold text-foreground">
                        {p.cliente.nombre}
                      </p>
                      <p className="whitespace-nowrap text-xs text-muted">
                        {p.numero} · {horaOFechaCorta(p.creadoEn)}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums">
                      {guaranies(p.total)}
                    </td>
                    <td className="px-3 py-2">
                      <EstadoChip pedido={p} />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        {p.estado !== "CARGADO" ? (
                          <BotonCopiar
                            etiqueta={`Copiar ${p.numero}`}
                            onClick={() => onCopiar(p)}
                          />
                        ) : null}
                        <BotonEditar
                          etiqueta={`Editar y enviar ${p.numero}`}
                          onClick={() => setAbierto(p)}
                        />
                        {p.eliminable ? (
                          <BotonEliminarCampo
                            etiqueta={`Eliminar ${p.numero}`}
                            onClick={() => void eliminar(p)}
                          />
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Paginacion
            page={datos.page}
            totalPages={datos.totalPages}
            total={datos.total}
            limit={limit}
            onPageChange={setPage}
            onLimitChange={(n) => {
              setLimit(n);
              setPage(1);
            }}
            desplazarAlInicio={false}
          />
        </>
      )}
      {abierto ? (
        <DocumentosPedidoModal
          key={abierto.id}
          pedido={abierto}
          onCerrar={() => setAbierto(null)}
          onCambio={refrescar}
        />
      ) : null}
    </section>
  );
}
