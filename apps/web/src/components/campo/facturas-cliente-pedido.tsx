"use client";

import { SkeletonFilas } from "@/components/skeleton";
import { useEffect, useId, useState } from "react";
import { apiFetch } from "@/lib/api";
import { BotonCopiar } from "@/components/boton-copiar";
import { Modal } from "@/components/modal";
import { mostrarToast } from "@/components/toast/toast-controller";
import { btnGhost } from "@/components/ui";
import type { FacturaCliente, LineaFacturaCliente } from "@/types/pedido";
import { formatoFechaCalendario } from "@/utils/fechas";

// SAP manda la fecha con hora en cero ("2026-11-13 00:00:00.000000000"): solo interesa el día.
const fechaFactura = (f: FacturaCliente) => formatoFechaCalendario(f.fecha.slice(0, 10)) ?? f.fecha;

/** Último pedido facturado del cliente en SAP y, en una hoja, los anteriores. */
export function FacturasClientePedido({
  cardCode,
  nombre,
  onCopiar,
}: {
  cardCode: string;
  nombre: string;
  onCopiar: (lineas: LineaFacturaCliente[]) => void;
}) {
  const [facturas, setFacturas] = useState<FacturaCliente[] | null>(null);
  const [error, setError] = useState("");
  const [intento, setIntento] = useState(0);
  const [anteriores, setAnteriores] = useState(false);
  // Acordeón: en "Pedidos anteriores" queda abierta una sola factura.
  const [abiertaAnterior, setAbiertaAnterior] = useState<number | null>(null);

  useEffect(() => {
    const control = new AbortController();
    apiFetch<FacturaCliente[]>(`/pedidos/clientes/${encodeURIComponent(cardCode)}/facturas`, {
      signal: control.signal,
    })
      .then((f) => {
        setFacturas(f);
        setError("");
      })
      .catch((e: unknown) => {
        if (!control.signal.aborted)
          setError(e instanceof Error ? e.message : "No se pudieron traer las facturas");
      });
    return () => control.abort();
  }, [cardCode, intento]);

  const [ultima, ...previas] = facturas ?? [];

  return (
    <div className="space-y-2">
      <section aria-label="Último pedido facturado" className="overflow-hidden rounded-2xl border border-line bg-surface-raised shadow-sm">
        {error ? (
          <>
            <CabeceraUltimo />
            <div className="flex items-center justify-between gap-2 border-t border-line px-4 py-3 text-sm text-muted">
              {error}
              <button type="button" onClick={() => setIntento((n) => n + 1)} className={btnGhost}>
                Reintentar
              </button>
            </div>
          </>
        ) : !facturas ? (
          <>
            <CabeceraUltimo />
            <SkeletonFilas etiqueta="Cargando facturas…" filas={1} className="border-t border-line px-4 py-3" />
          </>
        ) : !ultima ? (
          <>
            <CabeceraUltimo />
            <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
              <span className="text-muted">Pedido vacío</span>
              <span className="text-xl font-extrabold tabular-nums text-foreground">Gs. 0</span>
            </div>
          </>
        ) : (
          <FacturaDesplegable cardCode={cardCode} factura={ultima} destacada onCopiar={onCopiar} />
        )}
      </section>
      {previas.length ? (
        <button type="button" onClick={() => setAnteriores(true)} className={`${btnGhost} w-full gap-2`}>
          <IconoHistorial />
          {previas.length} anterior{previas.length === 1 ? "" : "es"}
        </button>
      ) : null}
      <Modal
        titulo="Pedidos anteriores"
        abierto={anteriores}
        onCerrar={() => setAnteriores(false)}
        hojaMovil
        textoCerrar="Cerrar"
        encabezado={
          <div>
            <p className="text-base font-extrabold text-foreground sm:text-lg">Pedidos anteriores</p>
            <p className="text-sm text-muted">
              {nombre} · {previas.length} pedido{previas.length === 1 ? "" : "s"} antes del último
            </p>
          </div>
        }
      >
        <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface-raised">
          {previas.map((f) => (
            <FacturaDesplegable
              key={f.docEntry}
              cardCode={cardCode}
              factura={f}
              onCopiar={onCopiar}
              abierto={abiertaAnterior === f.docEntry}
              onAbierto={(abrir) => setAbiertaAnterior(abrir ? f.docEntry : null)}
            />
          ))}
        </div>
      </Modal>
    </div>
  );
}

const CLASE_CABECERA = "flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left";

function IconoCarrito() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7 shrink-0 text-brand-700 dark:text-brand-200" aria-hidden>
      <path d="M3 4h2l2.4 10.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.76L20 8H6.2" />
      <circle cx="9" cy="19" r="1.4" />
      <circle cx="17" cy="19" r="1.4" />
    </svg>
  );
}

function FlechaDerecha({ abierta = false }: { abierta?: boolean }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={`h-5 w-5 shrink-0 text-muted transition-transform ${abierta ? "rotate-90" : ""}`} aria-hidden>
      <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.17 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02z" clipRule="evenodd" />
    </svg>
  );
}

/** Cabecera fija de la tarjeta mientras no hay una factura para desplegar. */
function CabeceraUltimo() {
  return (
    <div className={CLASE_CABECERA}>
      <IconoCarrito />
      <h2 className="min-w-0 flex-1 text-lg font-bold text-foreground">Último pedido facturado</h2>
    </div>
  );
}

/** Factura con su detalle de productos, que se pide recién al desplegarlo. */
function FacturaDesplegable({
  cardCode,
  factura,
  destacada,
  onCopiar,
  abierto: abiertoControlado,
  onAbierto,
}: {
  cardCode: string;
  factura: FacturaCliente;
  destacada?: boolean;
  onCopiar: (lineas: LineaFacturaCliente[]) => void;
  /** Con estos dos, el que la contiene decide cuál está abierta (acordeón). */
  abierto?: boolean;
  onAbierto?: (abierto: boolean) => void;
}) {
  const [abiertoPropio, setAbiertoPropio] = useState(false);
  const abierto = abiertoControlado ?? abiertoPropio;
  const setAbierto = onAbierto ?? setAbiertoPropio;
  const [lineas, setLineas] = useState<LineaFacturaCliente[] | null>(null);
  const [cargando, setCargando] = useState(false);
  const detalleId = useId();

  async function alternar() {
    const abrir = !abierto;
    setAbierto(abrir);
    if (!abrir || lineas || cargando) return;
    setCargando(true);
    try {
      setLineas(
        await apiFetch<LineaFacturaCliente[]>(
          `/pedidos/clientes/${encodeURIComponent(cardCode)}/facturas/${factura.docEntry}`,
        ),
      );
    } catch (e) {
      setAbierto(false);
      mostrarToast("error", e instanceof Error ? e.message : "No se pudo traer el detalle");
    } finally {
      setCargando(false);
    }
  }

  const productos = lineas ? `${lineas.length} producto${lineas.length === 1 ? "" : "s"}` : "";
  const flecha = (
    <svg viewBox="0 0 20 20" fill="currentColor" className={`h-5 w-5 shrink-0 transition-transform ${abierto ? "rotate-180" : ""}`} aria-hidden>
      <path d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" />
    </svg>
  );

  return (
    <div>
      {destacada ? (
        <>
          <button
            type="button"
            onClick={() => void alternar()}
            aria-expanded={abierto}
            aria-controls={detalleId}
            aria-label={`${abierto ? "Ocultar" : "Ver"} productos de la factura ${factura.docNum}`}
            className={`${CLASE_CABECERA} cursor-pointer transition-colors hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus`}
          >
            <IconoCarrito />
            <span className="min-w-0 flex-1 text-lg font-bold text-foreground">Último pedido facturado</span>
            <FlechaDerecha abierta={abierto} />
          </button>
          <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
            <span className="min-w-0 text-muted">
              Factura {factura.docNum} · {fechaFactura(factura)}
              {productos ? ` · ${productos}` : ""}
            </span>
            <span className="shrink-0 text-xl font-extrabold tabular-nums text-foreground">{factura.montoTotal}</span>
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={() => void alternar()}
          aria-expanded={abierto}
          aria-controls={detalleId}
          className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
        >
          <span className="min-w-0">
            <span className="block font-bold text-foreground">Factura {factura.docNum}</span>
            <span className="block text-xs text-muted">
              {fechaFactura(factura)}
              {productos ? ` · ${productos}` : ""}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1 font-extrabold tabular-nums text-foreground">
            {factura.montoTotal}
            {flecha}
          </span>
        </button>
      )}
      {abierto ? (
        <div id={detalleId} className="border-t border-line">
          {!lineas ? (
            <SkeletonFilas etiqueta="Cargando detalle…" filas={2} className="px-4 py-3" />
          ) : (
            <ul aria-label={`Productos de la factura ${factura.docNum}`} className="divide-y divide-line">
              {lineas.map((l, i) => (
                <li key={`${l.itemCode}-${i}`} className="flex justify-between gap-3 px-4 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="block text-foreground">{l.nombre}</span>
                    <span className="block text-xs text-muted">
                      {l.cantidad} u. × {l.precioUnitario}
                    </span>
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums text-foreground">{l.precioTotal}</span>
                </li>
              ))}
              <li className="flex justify-between gap-3 bg-surface-soft px-4 py-2.5 font-bold text-foreground">
                <span>Total</span>
                <span className="tabular-nums">{factura.montoTotal}</span>
              </li>
              <li className="p-2">
                <BotonCopiar
                  modo="texto"
                  etiqueta={`Copiar factura ${factura.docNum} a un pedido nuevo`}
                  className="w-full"
                  onClick={() => onCopiar(lineas)}
                />
              </li>
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

function IconoHistorial() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
