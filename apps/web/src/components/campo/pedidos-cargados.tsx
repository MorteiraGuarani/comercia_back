"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { BotonEditar } from "@/components/boton-editar";
import { DocumentosPedidoModal } from "@/components/campo/documentos-pedido-modal";
import { Paginacion } from "@/components/paginacion";
import { errorBox } from "@/components/ui";
import type { RespuestaPaginada } from "@/types/paginacion";
import type { PedidoResumen } from "@/types/pedido";
import { horaOFechaCorta } from "@/utils/fechas";
import { ESTADOS_PEDIDO, guaranies } from "@/utils/pedidos";

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

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold text-foreground">Pedidos cargados</h2>
      {error ? (
        <p className={errorBox}>{error}</p>
      ) : !datos ? (
        <p className="text-sm text-muted">Cargando pedidos…</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-line bg-surface-raised">
            <table className="w-full text-sm">
              <thead className="bg-surface-soft text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2 font-semibold">Pedido</th>
                  <th className="px-3 py-2 text-right font-semibold">Total</th>
                  <th className="px-3 py-2 text-right font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {datos.items.map((p) => (
                  <tr key={p.id}>
                    <td className="max-w-0 px-3 py-2">
                      <p className="truncate font-semibold text-foreground">
                        {p.cliente.nombre}
                      </p>
                      <p className="text-xs text-muted">
                        {horaOFechaCorta(p.creadoEn)} · {p.numero}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums">
                      {guaranies(p.total)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-bold text-accent">
                          {ESTADOS_PEDIDO.find((e) => e.id === p.estado)?.nombre ?? p.estado}
                        </span>
                        <BotonEditar
                          etiqueta={`Editar y enviar ${p.numero}`}
                          onClick={() => setAbierto(p)}
                        />
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
