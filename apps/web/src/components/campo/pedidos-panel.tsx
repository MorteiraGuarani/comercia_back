"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { enviarAccionTarea } from "@/lib/pendientes-tareas";
import { usePanel } from "@/components/panel/contexto";
import { BotonEditar } from "@/components/boton-editar";
import { IconoMas } from "@/components/icono-mas";
import { PantallaCarga } from "@/components/pantalla-carga";
import { SelectorPaginado } from "@/components/selector-paginado";
import { mostrarToast } from "@/components/toast/toast-controller";
import {
  btnGhost,
  btnPrimary,
  errorBox,
  inputBase,
  labelBase,
} from "@/components/ui";
import { ProductosLineaPedido } from "@/components/campo/productos-linea-pedido";
import { PedidosCargados } from "@/components/campo/pedidos-cargados";
import { PendientesTareas } from "@/components/campo/pendientes-tareas";
import { FacturasClientePedido } from "@/components/campo/facturas-cliente-pedido";
import type {
  ItemPedido,
  LineaPedido,
  PedidoDetalle,
  PedidoSap,
  PerfilClientePedido,
  ProductoPedido,
} from "@/types/pedido";
import { agregarDiasIso, fechaEnZonaIso, formatoDiaLargo } from "@/utils/fechas";
import { ESTADOS_PEDIDO, guaranies, LINEAS_PEDIDO } from "@/utils/pedidos";

type Paso =
  | { k: "cliente"; t: string }
  | { k: "linea"; t: string; linea: LineaPedido }
  | { k: "revisar"; t: string };

const PASOS: Paso[] = [
  { k: "cliente", t: "Cliente" },
  ...LINEAS_PEDIDO.map((l) => ({ k: "linea" as const, t: l.nombre, linea: l.id })),
  { k: "revisar", t: "Revisar" },
];

const chip =
  "inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-full border px-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50";

/** Asistente de carga de pedidos de preventa. */
export function PedidosPanel() {
  const { usuario } = usePanel();
  const hoy = fechaEnZonaIso(new Date());
  const manana = agregarDiasIso(hoy, 1);
  const [paso, setPaso] = useState(0);
  const [cliente, setCliente] = useState<{ id: string; nombre: string } | null>(
    null,
  );
  const [perfil, setPerfil] = useState<PerfilClientePedido | null>(null);
  const [errorPerfil, setErrorPerfil] = useState("");
  const [items, setItems] = useState<Record<string, ItemPedido>>({});
  const [entrega, setEntrega] = useState(manana);
  const [guardando, setGuardando] = useState(false);
  const [viendoSap, setViendoSap] = useState(false);
  const [error, setError] = useState("");
  const [pedido, setPedido] = useState<PedidoDetalle | null>(null);
  const [versionLista, setVersionLista] = useState(0);
  const refrescarLista = useCallback(() => setVersionLista((v) => v + 1), []);
  const pasosRef = useRef<HTMLElement>(null);

  // La pestaña activa queda centrada para no perderla al avanzar.
  useEffect(() => {
    pasosRef.current
      ?.querySelector('[aria-current="step"]')
      ?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [paso]);

  useEffect(() => {
    if (!cliente) return;
    const control = new AbortController();
    apiFetch<PerfilClientePedido>(
      `/pedidos/clientes/${encodeURIComponent(cliente.id)}`,
      { signal: control.signal },
    )
      .then((p) => {
        setPerfil(p);
        setErrorPerfil("");
      })
      .catch((e: unknown) => {
        if (!control.signal.aborted)
          setErrorPerfil(
            e instanceof Error ? e.message : "No se pudo traer el cliente",
          );
      });
    return () => control.abort();
  }, [cliente]);

  const lista = Object.values(items);
  const unidades = lista.reduce((suma, i) => suma + i.cantidad, 0);
  const total = lista.reduce((suma, i) => suma + (i.precio ?? 0) * i.cantidad, 0);
  const actual = PASOS[paso];
  // Inhabilitado en SAP (facturas vencidas): no se le carga el pedido.
  const bloqueado = perfil?.credito?.habilitado === false;
  const ultimo = paso === PASOS.length - 1;

  function ir(i: number) {
    setPaso(Math.max(0, Math.min(PASOS.length - 1, i)));
    setError("");
    window.scrollTo(0, 0);
  }

  function elegirCliente(opcion: { id: string; nombre?: string } | null) {
    if (opcion && opcion.id === cliente?.id) return;
    // Los precios dependen de la lista del cliente: cambiarlo vacía el pedido.
    setItems({});
    setPerfil(null);
    setCliente(opcion ? { id: opcion.id, nombre: opcion.nombre ?? opcion.id } : null);
  }

  function cantidad(linea: LineaPedido, p: ProductoPedido, n: number) {
    const valor = Math.max(0, Math.min(9999, Math.trunc(n) || 0));
    setItems((actuales) => {
      const siguientes = { ...actuales };
      if (valor) siguientes[p.itemCode] = { ...p, linea, cantidad: valor };
      else delete siguientes[p.itemCode];
      return siguientes;
    });
  }

  const datosPedido = () => ({
    cardCode: cliente?.id,
    fechaEntrega: entrega,
    lineas: lista.map((i) => ({ itemCode: i.itemCode, cantidad: i.cantidad })),
  });

  // Ver no guarda ni envía: solo muestra el JSON en consola.
  async function verSap() {
    if (!cliente || !lista.length || viendoSap) return;
    setViendoSap(true);
    try {
      const pedidos = await apiFetch<PedidoSap[]>("/pedidos/vista-sap", {
        method: "POST",
        body: JSON.stringify(datosPedido()),
      });
      console.log("Pedidos para SAP", pedidos);
    } catch (e) {
      mostrarToast("error", e instanceof Error ? e.message : "No se pudo armar el JSON para SAP");
    } finally {
      setViendoSap(false);
    }
  }

  // Primero queda guardado en Comercia o, sin señal, en este dispositivo.
  async function guardar(enviarSap: boolean) {
    if (!cliente || !lista.length || guardando) return;
    setGuardando(true);
    setError("");
    try {
      const { pendiente, resultado } = await enviarAccionTarea<PedidoDetalle>(
        usuario.id,
        "/pedidos",
        `Pedido de ${cliente.nombre}`,
        { ...datosPedido(), enviarSap },
      );
      if (pendiente || !resultado) {
        mostrarToast(
          "alerta",
          `El pedido quedó guardado en este dispositivo y ${enviarSap ? "se envía a SAP" : "se sincroniza"} al volver la conexión`,
        );
        nuevo();
        return;
      }
      setPedido(resultado);
      const rechazados = resultado.documentos.filter((d) => d.errorSap).length;
      if (rechazados)
        mostrarToast(
          "alerta",
          `Pedido ${resultado.numero} guardado, pero ${rechazados} de ${resultado.documentos.length} documentos no llegaron a SAP`,
        );
      else
        mostrarToast(
          "exito",
          `Pedido ${resultado.numero} ${enviarSap ? "enviado a SAP" : "guardado"}`,
        );
      window.scrollTo(0, 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el pedido");
      mostrarToast("error", "No se pudo guardar el pedido");
    } finally {
      setGuardando(false);
    }
  }

  function nuevo() {
    setPedido(null);
    setCliente(null);
    setPerfil(null);
    setItems({});
    setEntrega(manana);
    ir(0);
  }

  const encabezado = (
    <header className="sticky top-0 z-20 space-y-2.5 border-b border-line bg-background/95 px-4 pb-2.5 pt-3 backdrop-blur lg:col-span-2 lg:px-0 lg:pt-5">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
          {formatoDiaLargo(hoy)} · Preventa · {usuario.nombre} {usuario.apellido}
        </p>
        <h1 className="truncate text-xl font-bold leading-tight text-foreground">
          {pedido ? `Pedido ${pedido.numero}` : cliente?.nombre ?? "Nuevo pedido"}
        </h1>
        {cliente ? (
          <p className="truncate text-xs text-muted">
            Cliente SAP <span className="font-mono">{cliente.id}</span>
            {perfil?.direccion ? ` · ${perfil.direccion}` : ""}
          </p>
        ) : null}
      </div>
      {!pedido ? (
        <>
          <nav
            ref={pasosRef}
            aria-label="Pasos del pedido"
            className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none]"
          >
            {PASOS.map((p, i) => {
              const cargados =
                p.k === "linea" ? lista.filter((x) => x.linea === p.linea).length : 0;
              const activo = i === paso;
              return (
                <button
                  key={p.t}
                  type="button"
                  onClick={() => ir(i)}
                  disabled={i > 0 && (!cliente || bloqueado)}
                  aria-current={activo ? "step" : undefined}
                  className={`${chip} ${
                    activo
                      ? "border-foreground bg-foreground text-background"
                      : "border-line bg-surface-raised text-muted hover:border-brand-500"
                  }`}
                >
                  <span
                    className={`grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${
                      activo
                        ? "bg-background text-foreground"
                        : i < paso
                          ? "bg-brand-700 text-white"
                          : "bg-surface-soft"
                    }`}
                  >
                    {i + 1}
                  </span>
                  {p.t}
                  {cargados ? (
                    <span className="rounded-lg bg-accent-soft px-1.5 text-xs text-accent">
                      {cargados}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
          <div className="h-1 overflow-hidden rounded-full bg-surface-soft" aria-hidden>
            <i
              className="block h-full bg-brand-600 transition-[width]"
              style={{ width: `${(paso / (PASOS.length - 1)) * 100}%` }}
            />
          </div>
        </>
      ) : null}
    </header>
  );

  if (pedido)
    return (
      <div className="mx-auto w-full min-w-0 max-w-md lg:max-w-6xl lg:px-6">
        {encabezado}
        <div className="space-y-4 px-4 py-4 lg:grid lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start lg:gap-6 lg:space-y-0 lg:px-0 lg:py-6">
          <div className="space-y-4">
            <EstadoPedido pedido={pedido} />
            <button type="button" onClick={nuevo} className={`${btnPrimary} w-full`}>
              Nuevo pedido
            </button>
            <PendientesTareas onSincronizar={refrescarLista} />
          </div>
          <PedidosCargados key={versionLista} />
        </div>
      </div>
    );

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-8rem)] w-full min-w-0 max-w-md flex-col lg:grid lg:max-w-6xl lg:grid-cols-[minmax(0,1fr)_22rem] lg:content-start lg:items-start lg:gap-x-6 lg:px-6">
      <PantallaCarga visible={guardando} mensaje="Guardando pedido" />
      <PantallaCarga visible={viendoSap} mensaje="Armando JSON para SAP" />
      {encabezado}
      <section className="flex-1 px-4 py-4 lg:grid lg:grid-cols-[3.5rem_minmax(0,1fr)_3.5rem] lg:gap-3 lg:px-0 lg:py-6">
        <FlechaLateral
          atras
          etiqueta={paso ? `Volver a ${PASOS[paso - 1].t}` : "Paso anterior"}
          disabled={paso === 0}
          onClick={() => ir(paso - 1)}
        />
        <div className="min-w-0 space-y-3">
        <PendientesTareas onSincronizar={refrescarLista} />
        {actual.k === "cliente" ? (
          <div className="space-y-3">
            <div className="relative [&_input]:pr-12">
            <SelectorPaginado<string>
              url="/pedidos/clientes"
              etiqueta="Cliente"
              etiquetaOculta
              buscable
              value={cliente?.id ?? ""}
              seleccionActual={cliente?.nombre}
              placeholder="Buscá por nombre o código"
              onChange={(id) => {
                if (!id) elegirCliente(null);
              }}
              onSeleccionar={(opcion) => elegirCliente(opcion)}
            />
            {cliente ? (
              <button
                type="button"
                onClick={() => elegirCliente(null)}
                aria-label="Borrar cliente"
                title="Borrar cliente"
                className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 cursor-pointer place-items-center rounded-lg text-xl text-muted transition hover:bg-surface-soft hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                ×
              </button>
            ) : null}
            </div>
            {lista.length ? (
              <p className="text-xs text-muted">Cambiar de cliente vacía el pedido.</p>
            ) : null}
            {!cliente ? null : errorPerfil ? (
              <p className={errorBox}>{errorPerfil}</p>
            ) : !perfil ? (
              <p className="py-6 text-center text-sm text-muted">Cargando cliente…</p>
            ) : (
              <>
                <PerfilCliente perfil={perfil} />
                <FacturasClientePedido cardCode={perfil.id} nombre={perfil.nombre} />
              </>
            )}
            {!cliente ? <PedidosCargados key={versionLista} /> : null}
          </div>
        ) : null}

        {actual.k === "linea" && cliente ? (
          <ProductosLineaPedido
            key={actual.linea}
            cardCode={cliente.id}
            linea={actual.linea}
            nombreLinea={actual.t}
            items={items}
            onCantidad={(p, n) => cantidad(actual.linea, p, n)}
          />
        ) : null}

        {actual.k === "revisar" ? (
          <div className="space-y-3">
            <div className="overflow-hidden rounded-2xl border border-line bg-surface-raised">
              {LINEAS_PEDIDO.map((l) => {
                const grupo = lista.filter((i) => i.linea === l.id);
                return (
                  <div key={l.id} className="border-t border-line first:border-t-0">
                    <div className="flex items-center justify-between bg-surface-soft px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-muted">
                      <span>
                        {l.nombre} · {grupo.length}
                      </span>
                      {grupo.length ? (
                        <BotonEditar
                          etiqueta={`Editar ${l.nombre}`}
                          onClick={() => ir(PASOS.findIndex((p) => p.t === l.nombre))}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => ir(PASOS.findIndex((p) => p.t === l.nombre))}
                          aria-label={`Agregar en ${l.nombre}`}
                          title={`Agregar en ${l.nombre}`}
                          className="inline-grid h-11 w-11 cursor-pointer place-items-center rounded-md text-muted transition-colors hover:bg-surface-soft hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 md:h-9 md:w-9"
                        >
                          <IconoMas />
                        </button>
                      )}
                    </div>
                    {grupo.map((i) => (
                      <div
                        key={i.itemCode}
                        className="flex justify-between gap-3 border-t border-line px-3 py-2 text-sm"
                      >
                        <span className="min-w-0">
                          {i.nombre}
                          <br />
                          <span className="text-xs text-muted">
                            {i.cantidad} u. ×{" "}
                            {i.precio === null ? "sin precio" : guaranies(i.precio)}
                          </span>
                        </span>
                        <span className="shrink-0 font-semibold tabular-nums">
                          {i.precio === null ? "—" : guaranies(i.precio * i.cantidad)}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })}
              {lista.length ? (
                <div className="flex justify-between border-t border-line bg-surface-soft px-3 py-2.5 font-bold">
                  <span>Total</span>
                  <span className="tabular-nums">{guaranies(total)}</span>
                </div>
              ) : null}
            </div>
            {lista.some((i) => i.precio === null) ? (
              <p className="text-xs text-muted">
                Los productos sin precio en la lista del cliente no suman al total.
              </p>
            ) : null}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className={labelBase}>
                Entrega
                <input
                  type="date"
                  value={entrega}
                  min={manana}
                  onChange={(e) => setEntrega(e.target.value)}
                  className={inputBase}
                />
              </label>
            </div>
            {error ? <p className={errorBox}>{error}</p> : null}
          </div>
        ) : null}
        </div>
        <FlechaLateral
          etiqueta={ultimo ? "Último paso" : `Siguiente: ${PASOS[paso + 1].t}`}
          disabled={ultimo || !cliente || bloqueado}
          onClick={() => ir(paso + 1)}
        />
      </section>

      <footer className="sticky bottom-[calc(61px+env(safe-area-inset-bottom))] z-20 space-y-2 border-t border-line bg-surface-raised px-4 py-2.5 lg:bottom-auto lg:top-44 lg:mt-6 lg:space-y-3 lg:rounded-2xl lg:border lg:p-4">
        {/* En pantallas grandes el pie es un resumen lateral del pedido. */}
        <div className="hidden lg:block">
          <h2 className="text-base font-bold text-foreground">Tu pedido</h2>
          {lista.length ? (
            <ul className="mt-2 max-h-[45vh] divide-y divide-line overflow-y-auto text-sm">
              {lista.map((i) => (
                <li key={i.itemCode} className="flex justify-between gap-3 py-1.5">
                  <span className="min-w-0 truncate">
                    <b className="tabular-nums">{i.cantidad}</b> × {i.nombre}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted">
                    {i.precio === null ? "—" : guaranies(i.precio * i.cantidad)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-muted">Todavía no cargaste productos.</p>
          )}
        </div>
        <p className="flex items-baseline justify-between text-sm text-muted">
          <span>
            {lista.length
              ? `${lista.length} producto${lista.length === 1 ? "" : "s"} · ${unidades} u.`
              : "Pedido vacío"}
          </span>
          <b className="text-lg tabular-nums text-foreground">{guaranies(total)}</b>
        </p>
        <div
          className={`grid gap-2 ${ultimo ? "grid-cols-[auto_1fr_1fr_auto] lg:grid-cols-[1fr_1fr_auto]" : "grid-cols-[auto_1fr] lg:hidden lg:grid-cols-1"}`}
        >
          <button
            type="button"
            onClick={() => ir(paso - 1)}
            disabled={paso === 0}
            aria-label={paso ? `Volver a ${PASOS[paso - 1].t}` : "Paso anterior"}
            title={paso ? `Volver a ${PASOS[paso - 1].t}` : undefined}
            className={`${btnGhost} h-14 w-14 rounded-2xl px-0 lg:hidden`}
          >
            <Flecha atras />
          </button>
          <button
            type="button"
            onClick={() => (ultimo ? void guardar(false) : ir(paso + 1))}
            disabled={bloqueado || (ultimo ? !lista.length || guardando : !cliente)}
            title={ultimo ? "Guarda el pedido para editarlo y enviarlo después" : undefined}
            className={`${ultimo ? btnGhost : btnPrimary} h-14 gap-2 rounded-2xl text-base`}
          >
            {ultimo ? "Guardar" : `Siguiente: ${PASOS[paso + 1].t}`}
            {ultimo ? null : <Flecha />}
          </button>
          {ultimo ? (
            <button
              type="button"
              onClick={() => void guardar(true)}
              disabled={bloqueado || !lista.length || guardando}
              title="Guarda el pedido y lo envía a SAP"
              className={`${btnPrimary} h-14 rounded-2xl text-base`}
            >
              Enviar
            </button>
          ) : null}
          {ultimo ? (
            <button
              type="button"
              disabled={!cliente || !lista.length || viendoSap}
              onClick={() => void verSap()}
              title="Muestra en la consola el JSON para SAP"
              className={`${btnGhost} h-14 rounded-2xl px-5 text-base`}
            >
              Ver
            </button>
          ) : null}
        </div>
      </footer>
    </div>
  );
}

/** Flecha de carrusel a un costado del paso (solo pantallas grandes). */
function FlechaLateral({
  atras,
  etiqueta,
  disabled,
  onClick,
}: {
  atras?: boolean;
  etiqueta: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <div className="hidden lg:flex lg:items-center">
      {/* Centrada en el paso; con listas largas queda fija en el medio de la pantalla. */}
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={etiqueta}
        title={etiqueta}
        className="sticky top-[calc(50vh-1.75rem)] bottom-[calc(50vh-1.75rem)] grid h-14 w-14 cursor-pointer place-items-center rounded-full border border-control-line bg-surface-raised text-foreground shadow-lg transition hover:border-brand-500 hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-control-line disabled:hover:bg-surface-raised"
      >
        <Flecha atras={atras} />
      </button>
    </div>
  );
}

function Flecha({ atras }: { atras?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={atras ? "M15 18l-6-6 6-6" : "m9 18 6-6-6-6"} />
    </svg>
  );
}

const TONO_DATO = {
  normal: "text-foreground",
  ok: "text-emerald-700 dark:text-emerald-300",
  mal: "text-red-700 dark:text-red-300",
};

function Dato({
  k,
  v,
  ancho,
  tono = "normal",
  detalle,
}: {
  k: string;
  v: string;
  /** Línea chica debajo del valor. */
  detalle?: string;
  ancho?: boolean;
  tono?: keyof typeof TONO_DATO;
}) {
  return (
    <div
      className={`min-w-0 rounded-xl border border-line bg-surface-raised px-3 py-2 ${
        ancho ? "col-span-full" : ""
      }`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{k}</p>
      <p className={`mt-0.5 break-words font-semibold ${TONO_DATO[tono]}`}>{v}</p>
      {detalle ? <p className="text-xs text-muted">{detalle}</p> : null}
    </div>
  );
}

/** Perfil del cliente: el estado de crédito de SAP, en el orden de la maqueta. */
function PerfilCliente({ perfil }: { perfil: PerfilClientePedido }) {
  const c = perfil.credito;
  if (!c)
    return (
      <div className="grid grid-cols-2 gap-2">
        <Dato k="Estado" v="No se pudo consultar SAP" ancho />
      </div>
    );
  return (
    <div
      className="grid grid-cols-2 gap-2"
      role={c.habilitado ? undefined : "alert"}
    >
      <Dato
        k="Deuda pendiente"
        v={c.facturasPendientes ? c.montosPendientes.join(" · ") : "Sin deuda"}
      />
      <Dato k="Facturas pendientes" v={String(c.facturasPendientes)} />
      <Dato
        k="Estado"
        v={c.habilitado ? "Habilitado" : "Inhabilitado"}
        tono={c.habilitado ? "ok" : "mal"}
      />
      <Dato k="Deuda desde el" v={c.fechaFacturaInhabilitante ?? "—"} />
      <Dato
        k="Motivo"
        v={c.habilitado ? "—" : `${c.motivo || "Facturas vencidas"}. No se le puede cargar pedido.`}
        tono={c.habilitado ? "normal" : "mal"}
        ancho
      />
    </div>
  );
}

function EstadoPedido({ pedido }: { pedido: PedidoDetalle }) {
  const alcanzado = ESTADOS_PEDIDO.findIndex((e) => e.id === pedido.estado);
  return (
    <div className="space-y-4 rounded-2xl border border-line bg-surface-raised p-4">
      <div>
        <p className="text-sm text-muted">
          {pedido.cliente.nombre} · {guaranies(pedido.total)}
        </p>
        <h2 className="text-xl font-bold text-foreground">
          {ESTADOS_PEDIDO[alcanzado]?.nombre ?? pedido.estado}
        </h2>
        <p className="text-sm text-muted">
          Entrega {formatoDiaLargo(pedido.fechaEntrega)} · {pedido.cantidadProductos}{" "}
          producto{pedido.cantidadProductos === 1 ? "" : "s"}
        </p>
      </div>
      <div className="rounded-xl border border-dashed border-line bg-surface-soft px-3 py-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
          DocNum del pedido SAP
        </p>
        <p className="font-mono text-sm text-foreground">
          {pedido.documentos.flatMap((d) => d.docNum ?? []).join(", ") ||
            "Se asigna cuando el pedido llegue a SAP"}
        </p>
      </div>
      {pedido.documentos
        .filter((d) => d.errorSap)
        .map((d) => (
          <p key={d.id} className={errorBox}>
            {d.sap.DocumentLines[0]?.WarehouseCode || "Sin almacén"}: {d.errorSap}
          </p>
        ))}
      <ol className="space-y-2">
        {ESTADOS_PEDIDO.map((e, i) => (
          <li key={e.id} className="flex items-center gap-2.5 text-sm">
            <span
              aria-hidden
              className={`grid h-5 w-5 place-items-center rounded-full border-2 text-[10px] text-white ${
                i <= alcanzado
                  ? "border-brand-600 bg-brand-600"
                  : "border-line bg-surface-soft"
              }`}
            >
              {i <= alcanzado ? "✓" : ""}
            </span>
            <span className={i <= alcanzado ? "font-semibold text-foreground" : "text-muted"}>
              {e.nombre}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
