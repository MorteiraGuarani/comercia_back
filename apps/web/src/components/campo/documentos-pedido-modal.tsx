"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Modal } from "@/components/modal";
import { PantallaCarga } from "@/components/pantalla-carga";
import { mostrarToast } from "@/components/toast/toast-controller";
import {
  btnGhost,
  btnPrimary,
  errorBox,
  inputBase,
  labelBase,
} from "@/components/ui";
import type {
  DocumentoSap,
  PedidoDetalle,
  PedidoResumen,
} from "@/types/pedido";
import { agregarDiasIso, fechaEnZonaIso } from "@/utils/fechas";

/** Documentos de SAP de un pedido, uno por almacén: se editan y se envían cuando se quiera. */
export function DocumentosPedidoModal({
  pedido,
  onCerrar,
  onCambio,
}: {
  pedido: PedidoResumen;
  onCerrar: () => void;
  onCambio: () => void;
}) {
  const pedidoId = pedido.id;
  const [detalle, setDetalle] = useState<PedidoDetalle | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const control = new AbortController();
    apiFetch<PedidoDetalle>(`/pedidos/${pedidoId}`, { signal: control.signal })
      .then(setDetalle)
      .catch((e: unknown) => {
        if (!control.signal.aborted)
          setError(e instanceof Error ? e.message : "No se pudo traer el pedido");
      });
    return () => control.abort();
  }, [pedidoId]);

  const nombres = new Map(
    detalle?.lineas.map((l) => [l.itemCode, l.nombre] as const),
  );

  return (
    <Modal
      titulo={`Pedido ${pedido.numero}`}
      abierto
      onCerrar={onCerrar}
      textoCerrar="Cerrar"
      ancho="lg"
    >
      {error ? (
        <p className={errorBox}>{error}</p>
      ) : !detalle ? (
        <p className="py-6 text-center text-sm text-muted">Cargando documentos…</p>
      ) : !detalle.documentos.length ? (
        <p className="py-6 text-center text-sm text-muted">
          Este pedido se cargó antes de que se guardaran los documentos para SAP.
        </p>
      ) : (
        <div className="space-y-4">
          {detalle.documentos.map((d) => (
            <FormularioDocumento
              key={d.id}
              documento={d}
              nombres={nombres}
              onListo={(actualizado) => {
                setDetalle((actual) =>
                  actual && {
                    ...actual,
                    documentos: actual.documentos.map((x) =>
                      x.id === actualizado.id ? actualizado : x,
                    ),
                  },
                );
                onCambio();
                // Con varios almacenes queda abierto para seguir con los demás.
                if (detalle.documentos.length === 1) onCerrar();
              }}
            />
          ))}
        </div>
      )}
    </Modal>
  );
}

function FormularioDocumento({
  documento,
  nombres,
  onListo,
}: {
  documento: DocumentoSap;
  nombres: Map<string, string>;
  onListo: (actualizado: DocumentoSap) => void;
}) {
  const { sap, enviadoSap, docNum } = documento;
  const [entrega, setEntrega] = useState(sap.DocDueDate.slice(0, 10));
  const [comentarios, setComentarios] = useState(sap.Comments);
  const [lineas, setLineas] = useState(
    sap.DocumentLines.map((l) => ({
      ItemCode: l.ItemCode,
      Quantity: l.Quantity,
    })),
  );
  const [procesando, setProcesando] = useState("");
  const [error, setError] = useState("");
  const etiquetaAlmacen = sap.DocumentLines[0]?.WarehouseCode || "Sin almacén";

  // Enviar guarda primero: a SAP va siempre lo que quedó en Comercia.
  async function guardar(enviar: boolean) {
    setProcesando(enviar ? "Enviando a SAP" : "Guardando documento");
    setError("");
    try {
      let actualizado = await apiFetch<DocumentoSap>(
        `/pedidos/documentos/${documento.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            DocDueDate: entrega,
            Comments: comentarios,
            lineas,
          }),
        },
      );
      if (enviar)
        actualizado = await apiFetch<DocumentoSap>(
          `/pedidos/documentos/${documento.id}/enviar`,
          { method: "POST" },
        );
      mostrarToast(
        "exito",
        enviar
          ? `Enviado a SAP${actualizado.docNum ? `: documento ${actualizado.docNum}` : ""}`
          : "Documento guardado",
      );
      onListo(actualizado);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el documento");
    } finally {
      setProcesando("");
    }
  }

  return (
    <fieldset
      disabled={enviadoSap || !!procesando}
      className="min-w-0 space-y-3 rounded-2xl border border-line p-3"
    >
      <PantallaCarga visible={!!procesando} mensaje={procesando} />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-foreground">{etiquetaAlmacen}</p>
          <p className="truncate text-xs text-muted">
            {[sap.NumAtCard, sap.U_par].filter(Boolean).join(" · ") || "—"}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-bold text-accent">
          {enviadoSap ? `Enviado a SAP${docNum ? ` · ${docNum}` : ""}` : "Sin enviar"}
        </span>
      </div>
      <label className={labelBase}>
        Fecha de entrega
        <input
          type="date"
          min={agregarDiasIso(fechaEnZonaIso(new Date()), 1)}
          value={entrega}
          onChange={(e) => setEntrega(e.target.value)}
          className={inputBase}
        />
      </label>
      <label className={labelBase}>
        Comentarios
        <textarea
          rows={2}
          maxLength={254}
          value={comentarios}
          onChange={(e) => setComentarios(e.target.value)}
          className={inputBase}
        />
      </label>
      <ul className="divide-y divide-line rounded-xl border border-line">
        {lineas.map((l) => {
          const nombre = nombres.get(l.ItemCode) ?? l.ItemCode;
          return (
            <li key={l.ItemCode} className="flex items-center gap-2 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-medium text-foreground">
                  {nombre}
                </p>
                <p className="font-mono text-xs text-muted">{l.ItemCode}</p>
              </div>
              {/* inputBase trae w-full: el ancho lo fija este contenedor. */}
              <div className="w-20 shrink-0">
                <input
                  type="number"
                  min={1}
                  max={9999}
                  value={l.Quantity}
                  aria-label={`Cantidad de ${nombre}`}
                  onChange={(e) => {
                    const Quantity = Math.max(
                      1,
                      Math.min(9999, Math.trunc(Number(e.target.value)) || 1),
                    );
                    setLineas((actuales) =>
                      actuales.map((x) =>
                        x.ItemCode === l.ItemCode ? { ...x, Quantity } : x,
                      ),
                    );
                  }}
                  className={`${inputBase} text-right`}
                />
              </div>
              <button
                type="button"
                disabled={lineas.length === 1}
                aria-label={`Quitar ${nombre}`}
                title={`Quitar ${nombre}`}
                onClick={() =>
                  setLineas((actuales) =>
                    actuales.filter((x) => x.ItemCode !== l.ItemCode),
                  )
                }
                className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-lg text-xl text-muted transition hover:bg-surface-soft hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50"
              >
                ×
              </button>
            </li>
          );
        })}
      </ul>
      {error ? <p className={errorBox}>{error}</p> : null}
      {enviadoSap ? null : (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => void guardar(false)}
            className={btnGhost}
          >
            Guardar
          </button>
          <button
            type="button"
            onClick={() => void guardar(true)}
            title="Guarda el documento y lo envía a SAP"
            className={btnPrimary}
          >
            Enviar
          </button>
        </div>
      )}
    </fieldset>
  );
}
