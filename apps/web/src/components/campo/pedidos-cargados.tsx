"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { BotonEditar } from "@/components/boton-editar";
import { BotonEliminarCampo } from "@/components/campo/boton-eliminar-campo";
import { DocumentosPedidoModal } from "@/components/campo/documentos-pedido-modal";
import { confirmar } from "@/components/confirmacion/confirmacion-controller";
import { Paginacion } from "@/components/paginacion";
import { PantallaCarga } from "@/components/pantalla-carga";
import { mostrarToast } from "@/components/toast/toast-controller";
import { errorBox } from "@/components/ui";
import type { RespuestaPaginada } from "@/types/paginacion";
import type { PedidoResumen } from "@/types/pedido";
import { horaOFechaCorta } from "@/utils/fechas";
import { ESTADOS_PEDIDO, guaranies } from "@/utils/pedidos";

function EstadoChip({ pedido }: { pedido: PedidoResumen }) {
  return (
    <div className="flex shrink-0 flex-col items-end gap-0.5">
      <span className="whitespace-nowrap rounded-full bg-accent-soft px-2 py-0.5 text-xs font-bold text-accent">
        {ESTADOS_PEDIDO.find((e) => e.id === pedido.estado)?.nombre ?? pedido.estado}
      </span>
      {pedido.docNums.length ? (
        <span className="text-right font-mono text-xs text-muted">
          DocNum {pedido.docNums.join(", ")}
        </span>
      ) : null}
    </div>
  );
}

/** Pedidos que cargó el usuario, del más reciente al más viejo. */
export function PedidosCargados() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(7);
  const [datos, setDatos] = useState<RespuestaPaginada<PedidoResumen> | null>(
    null,
  );
  const [error, setError] = useState("");
  const [abierto, setAbierto] = useState<PedidoResumen | null>(null);
  const [recarga, setRecarga] = useState(0);
  const [eliminando, setEliminando] = useState(false);

  useEffect(() => {
    const control = new AbortController();
    apiFetch<RespuestaPaginada<PedidoResumen>>(
      `/pedidos?page=${page}&limit=${limit}`,
      { signal: control.signal },
    )
      .then(setDatos)
      .catch((e: unknown) => {
        if (!control.signal.aborted)
          setError(e instanceof Error ? e.message : "No se pudieron traer los pedidos");
      });
    return () => control.abort();
  }, [page, limit, recarga]);

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
      else setRecarga((n) => n + 1);
    } catch (e) {
      mostrarToast("error", e instanceof Error ? e.message : "No se pudo eliminar el pedido");
    } finally {
      setEliminando(false);
    }
  }

  return (
    <section className="w-full min-w-0 space-y-3">
      <PantallaCarga visible={eliminando} mensaje="Eliminando pedido" />
      <h2 className="text-lg font-bold text-foreground">Pedidos cargados</h2>
      {error ? (
        <p className={errorBox}>{error}</p>
      ) : !datos ? (
        <p className="text-sm text-muted">Cargando pedidos…</p>
      ) : (
        <>
          <ul
            aria-label="Pedidos cargados"
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
          onCambio={() => setRecarga((n) => n + 1)}
        />
      ) : null}
    </section>
  );
}
