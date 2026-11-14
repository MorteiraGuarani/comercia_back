"use client";

import { Skeleton, SkeletonFilas } from "@/components/skeleton";
import { useCallback, useEffect, useId, useRef, useState } from "react";
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
import { confirmar } from "@/components/confirmacion/confirmacion-controller";
import type {
  CopiaPedido,
  ItemPedido,
  LineaFacturaCliente,
  LineaPedido,
  LineaPedidoTab,
  PedidoDetalle,
  PedidoResumen,
  PerfilClientePedido,
  ProductoPedido,
} from "@/types/pedido";
import { agregarDiasIso, fechaEnZonaIso, formatoDiaLargo } from "@/utils/fechas";
import { ESTADOS_PEDIDO, guaranies, LINEA_OTROS } from "@/utils/pedidos";

type Paso =
  | { k: "cliente"; t: string }
  | { k: "linea"; t: string; linea: LineaPedido }
  | { k: "revisar"; t: string };


const chip =
  "inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-full border px-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50";

/** Asistente de carga de pedidos de preventa. */
export function PedidosPanel() {
  const { usuario } = usePanel();
  const hoy = fechaEnZonaIso(new Date());
  const manana = agregarDiasIso(hoy, 1);
  const [pasoElegido, setPaso] = useState(0);
  // Pestañas de productos según Categorías de la empresa; se piden una vez.
  const [lineas, setLineas] = useState<LineaPedidoTab[] | null>(null);
  const [errorLineas, setErrorLineas] = useState("");
  const [intentoLineas, setIntentoLineas] = useState(0);
  // Mientras no llegan, solo Cliente y Revisar.
  const pasos: Paso[] = [
    { k: "cliente", t: "Cliente" },
    ...(lineas ?? []).map((l) => ({ k: "linea" as const, t: l.nombre, linea: l.id })),
    { k: "revisar", t: "Revisar" },
  ];
  const [cliente, setCliente] = useState<{ id: string; nombre: string } | null>(
    null,
  );
  const [perfil, setPerfil] = useState<PerfilClientePedido | null>(null);
  // Inactivo o congelado, o inhabilitado por facturas vencidas: no se le carga el pedido.
  const bloqueado = perfil !== null && (!perfil.activo || perfil.credito?.habilitado === false);
  // Al copiar se salta a Revisar: si está inhabilitado, vuelve a ver el motivo.
  const paso = bloqueado ? 0 : Math.min(pasoElegido, pasos.length - 1);
  const [copiando, setCopiando] = useState(false);
  const [errorPerfil, setErrorPerfil] = useState("");
  const [items, setItems] = useState<Record<string, ItemPedido>>({});
  const [entrega, setEntrega] = useState(manana);
  const [observaciones, setObservaciones] = useState("");
  const [guardando, setGuardando] = useState(false);
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
    const control = new AbortController();
    apiFetch<LineaPedidoTab[]>("/pedidos/lineas", { signal: control.signal })
      .then((l) => {
        setLineas(l);
        setErrorLineas("");
      })
      .catch((e: unknown) => {
        if (!control.signal.aborted)
          setErrorLineas(e instanceof Error ? e.message : "No se pudieron traer las pestañas de productos");
      });
    return () => control.abort();
  }, [intentoLineas]);

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
  const actual = pasos[paso];
  // Un producto de una pestaña que ya no existe (Categorías cambió) se muestra en Otros.
  const idsLineas = new Set((lineas ?? []).map((l) => l.id));
  const lineaDe = (i: ItemPedido) => (idsLineas.has(i.linea) ? i.linea : LINEA_OTROS);
  const pasoDeLinea = (linea: LineaPedido) =>
    pasos.findIndex((p) => p.k === "linea" && p.linea === linea);
  const ultimo = paso === pasos.length - 1;

  // Pestaña de la que se saltó hacia atrás: «Siguiente» vuelve ahí y no paso a paso.
  const [volverA, setVolverA] = useState<number | null>(null);

  function ir(i: number) {
    setPaso(Math.max(0, Math.min(pasos.length - 1, i)));
    setError("");
    window.scrollTo(0, 0);
  }

  /** Salto elegido por el usuario (pestañas o Editar en Revisar). */
  function saltar(i: number) {
    if (i < paso) setVolverA((v) => Math.max(v ?? 0, paso));
    else if (volverA !== null && i >= volverA) setVolverA(null);
    ir(i);
  }

  function siguiente() {
    if (volverA !== null && volverA > paso) {
      setVolverA(null);
      ir(volverA);
    } else ir(paso + 1);
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
    // Sin almacén no se puede enviar a SAP: se avisa al elegirlo y no se agrega.
    if (valor && !items[p.itemCode] && !p.almacen) {
      mostrarToast("alerta", `${p.nombre} no tiene almacén: no se puede agregar`);
      return;
    }
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
    observaciones: observaciones.trim() || undefined,
    lineas: lista.map((i) => ({ itemCode: i.itemCode, cantidad: i.cantidad })),
  });

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

  async function copiarLineas(
    cardCode: string,
    origen: Pick<LineaFacturaCliente, "itemCode" | "nombre" | "cantidad">[],
    comentario = "",
  ) {
    if (
      !pedido &&
      lista.length &&
      !(await confirmar({
        titulo: "Copiar pedido",
        mensaje: "Se reemplaza lo que estás cargando en este pedido.",
        textoConfirmar: "Copiar",
      }))
    )
      return;
    setCopiando(true);
    try {
      const lineas = origen
        .filter((l) => l.itemCode)
        .map((l) => ({ itemCode: l.itemCode, cantidad: l.cantidad }));
      const copia = await apiFetch<CopiaPedido>("/pedidos/copia", {
        method: "POST",
        body: JSON.stringify({ cardCode, lineas }),
      });
      // Sin almacén no se puede enviar a SAP: queda afuera como los no disponibles.
      const copiables = copia.items.filter((i) => i.almacen);
      if (!copiables.length) {
        mostrarToast("error", "Ninguno de esos productos se puede pedir hoy");
        return;
      }
      setPedido(null);
      setPerfil(null);
      setCliente(copia.cliente);
      setItems(Object.fromEntries(copiables.map((i) => [i.itemCode, i])));
      setEntrega(manana);
      setObservaciones(comentario.slice(0, 200));
      setVolverA(null);
      ir(pasos.length - 1);
      const faltan = copia.noDisponibles.map(
        (c) => origen.find((l) => l.itemCode === c)?.nombre ?? c,
      );
      const sinAlmacen = copia.items.filter((i) => !i.almacen).map((i) => i.nombre);
      const avisos = [
        faltan.length ? `Ya no se pueden pedir: ${faltan.join(", ")}` : "",
        sinAlmacen.length ? `Sin almacén, quedaron afuera: ${sinAlmacen.join(", ")}` : "",
      ].filter(Boolean);
      mostrarToast(
        avisos.length ? "alerta" : "exito",
        avisos.length
          ? `Pedido copiado. ${avisos.join(". ")}`
          : "Pedido copiado con los precios de hoy: revisalo y envialo",
      );
    } catch (e) {
      mostrarToast("error", e instanceof Error ? e.message : "No se pudo copiar el pedido");
    } finally {
      setCopiando(false);
    }
  }

  async function copiarPedido(p: PedidoResumen) {
    setCopiando(true);
    try {
      const detalle = await apiFetch<PedidoDetalle>(`/pedidos/${p.id}`);
      await copiarLineas(detalle.cliente.id, detalle.lineas, detalle.observaciones);
    } catch (e) {
      mostrarToast("error", e instanceof Error ? e.message : "No se pudo copiar el pedido");
    } finally {
      setCopiando(false);
    }
  }

  function nuevo() {
    setPedido(null);
    setCliente(null);
    setPerfil(null);
    setItems({});
    setEntrega(manana);
    setObservaciones("");
    setVolverA(null);
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
            {pasos.map((p, i) => {
              const cargados =
                p.k === "linea" ? lista.filter((x) => lineaDe(x) === p.linea).length : 0;
              const activo = i === paso;
              return (
                <button
                  key={p.t}
                  type="button"
                  onClick={() => saltar(i)}
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
            {!lineas && !errorLineas ? (
              <span role="status" className="flex shrink-0 items-center gap-1.5">
                <span className="sr-only">Cargando pestañas de productos</span>
                <Skeleton className="h-11 w-32 rounded-full" />
                <Skeleton className="h-11 w-28 rounded-full" />
              </span>
            ) : null}
          </nav>
          {errorLineas ? (
            <div className={`${errorBox} flex items-center justify-between gap-2`}>
              <span className="min-w-0">{errorLineas}</span>
              <button type="button" className={btnGhost} onClick={() => setIntentoLineas((n) => n + 1)}>
                Reintentar
              </button>
            </div>
          ) : null}
          <div className="h-1 overflow-hidden rounded-full bg-surface-soft" aria-hidden>
            <i
              className="block h-full bg-brand-600 transition-[width]"
              style={{ width: `${(paso / (pasos.length - 1)) * 100}%` }}
            />
          </div>
        </>
      ) : null}
    </header>
  );

  if (pedido)
    return (
      <div className="mx-auto w-full min-w-0 max-w-md lg:max-w-6xl lg:px-6">
        <PantallaCarga visible={copiando} mensaje="Copiando pedido" />
        {encabezado}
        <div className="space-y-4 px-4 py-4 lg:grid lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start lg:gap-6 lg:space-y-0 lg:px-0 lg:py-6">
          <div className="space-y-4">
            <EstadoPedido pedido={pedido} />
            <button type="button" onClick={nuevo} className={`${btnPrimary} w-full`}>
              Nuevo pedido
            </button>
            <PendientesTareas onSincronizar={refrescarLista} />
          </div>
          <PedidosCargados key={versionLista} onCopiar={(p) => void copiarPedido(p)} />
        </div>
      </div>
    );

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-8rem)] w-full min-w-0 max-w-md flex-col lg:grid lg:max-w-6xl lg:grid-cols-[minmax(0,1fr)_22rem] lg:content-start lg:items-start lg:gap-x-6 lg:px-6">
      <PantallaCarga visible={guardando} mensaje="Guardando pedido" />
      <PantallaCarga visible={copiando} mensaje="Copiando pedido" />
      {encabezado}
      <section className="flex-1 px-4 py-4 lg:grid lg:grid-cols-[3.5rem_minmax(0,1fr)_3.5rem] lg:gap-3 lg:px-0 lg:py-6">
        <FlechaLateral
          atras
          etiqueta={paso ? `Volver a ${pasos[paso - 1].t}` : "Paso anterior"}
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
              conDescripcion
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
              <SkeletonFilas etiqueta="Cargando cliente…" filas={4} className="rounded-2xl border border-line bg-surface-raised p-4" />
            ) : (
              <>
                <PerfilCliente perfil={perfil} />
                <FacturasClientePedido
                  cardCode={perfil.id}
                  nombre={perfil.nombre}
                  onCopiar={(lineas) => void copiarLineas(perfil.id, lineas)}
                  bloqueado={bloqueado}
                />
              </>
            )}
            {!cliente ? (
              <PedidosCargados key={versionLista} onCopiar={(p) => void copiarPedido(p)} />
            ) : null}
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
              {(lineas?.length ? lineas : [{ id: LINEA_OTROS, nombre: "Otros" }]).map((l) => {
                const grupo = lista.filter((i) => lineaDe(i) === l.id);
                return (
                  <div key={l.id} className="border-t border-line first:border-t-0">
                    <div className="flex items-center justify-between bg-surface-soft px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-muted">
                      <span>
                        {l.nombre} · {grupo.length}
                      </span>
                      {grupo.length ? (
                        <BotonEditar
                          etiqueta={`Editar ${l.nombre}`}
                          onClick={() => saltar(pasoDeLinea(l.id))}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => saltar(pasoDeLinea(l.id))}
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
            <label className={labelBase}>
              Comentarios
              <textarea
                value={observaciones}
                maxLength={200}
                onChange={(e) => setObservaciones(e.target.value)}
                className={`${inputBase} min-h-20 resize-y`}
              />
            </label>
            <button
              type="button"
              onClick={() => void guardar(false)}
              disabled={bloqueado || !lista.length || guardando}
              title="Guarda el pedido para editarlo y enviarlo después"
              className={`${btnGhost} w-full`}
            >
              Guardar
            </button>
            {error ? <p className={errorBox}>{error}</p> : null}
          </div>
        ) : null}
        </div>
        <FlechaLateral
          etiqueta={ultimo ? "Último paso" : `Siguiente: ${pasos[paso + 1].t}`}
          disabled={ultimo || !cliente || bloqueado}
          onClick={siguiente}
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
          className={`grid grid-cols-[auto_1fr] gap-2 lg:grid-cols-1 ${ultimo ? "" : "lg:hidden"}`}
        >
          <button
            type="button"
            onClick={() => ir(paso - 1)}
            disabled={paso === 0}
            aria-label={paso ? `Volver a ${pasos[paso - 1].t}` : "Paso anterior"}
            title={paso ? `Volver a ${pasos[paso - 1].t}` : undefined}
            className={`${btnGhost} h-14 w-14 rounded-2xl px-0 lg:hidden`}
          >
            <Flecha atras />
          </button>
          <button
            type="button"
            onClick={() => (ultimo ? void guardar(true) : siguiente())}
            disabled={bloqueado || (ultimo ? !lista.length || guardando : !cliente)}
            title={ultimo ? "Guarda el pedido y lo envía a SAP" : undefined}
            className={`${btnPrimary} h-14 gap-2 rounded-2xl text-base`}
          >
            {ultimo ? "Enviar" : "Siguiente"}
            {ultimo ? null : <Flecha />}
          </button>
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

/** Ícono de trazo para las cabeceras de tarjeta del perfil. */
function IconoTrazo({ d, className = "h-6 w-6" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`} aria-hidden>
      <path d={d} />
    </svg>
  );
}

const ICONO_PERSONA = "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20a8 8 0 0 1 16 0";
const ICONO_INFO = "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 7.5v.01";

/** Perfil del cliente: su estado en SAP (activo y crédito) en una franja de tres datos. */
function PerfilCliente({ perfil }: { perfil: PerfilClientePedido }) {
  const c = perfil.credito;
  const motivoId = useId();
  // Inactivo o congelado manda sobre el crédito: no se le carga pedido aunque no deba nada.
  const estado = !perfil.activo
    ? { texto: "Inactivo", tipo: "inactivo", motivo: "Cliente inactivo o congelado en SAP. No se le puede cargar pedido." }
    : !c
      ? null
      : c.habilitado
        ? { texto: "Habilitado", tipo: "ok", motivo: "Sin restricciones" }
        : { texto: "Inhabilitado", tipo: "mal", motivo: `${c.motivo || "Facturas vencidas"}. No se le puede cargar pedido.` };
  const [verMotivo, setVerMotivo] = useState(false);
  // Verde habilitado, rojo inhabilitado por deuda, gris inactivo o congelado.
  const tonos = {
    ok: {
      franja: "border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/30",
      pildora: "bg-emerald-200/70 text-emerald-900 dark:bg-emerald-800/60 dark:text-emerald-50",
      texto: "text-foreground",
    },
    mal: {
      franja: "border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/30",
      pildora: "bg-red-200/70 text-red-900 dark:bg-red-800/60 dark:text-red-50",
      texto: "text-red-700 dark:text-red-300",
    },
    inactivo: {
      franja: "border-line bg-surface-soft",
      pildora: "bg-zinc-300 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-100",
      texto: "text-foreground",
    },
  } as const;
  const t = estado ? tonos[estado.tipo as keyof typeof tonos] : null;
  const tono = t ? t.franja : "border-line bg-surface-soft";
  return (
    <section
      aria-label="Perfil del cliente"
      role={estado && estado.tipo !== "ok" ? "alert" : undefined}
      className="space-y-3 rounded-2xl border border-line bg-surface-raised p-2.5 shadow-sm"
    >
      <div className="flex min-w-0 items-center gap-3">
        <IconoTrazo d={ICONO_PERSONA} className="h-7 w-7 text-foreground" />
        <h2 className="min-w-0 flex-1 text-lg font-bold text-foreground">Perfil del cliente</h2>
        {estado ? (
          <button
            type="button"
            onClick={() => setVerMotivo((v) => !v)}
            aria-expanded={verMotivo}
            aria-controls={motivoId}
            aria-label={verMotivo ? "Ocultar detalle del estado" : "Ver detalle del estado"}
            title="Detalle del estado"
            className={`grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
              verMotivo
                ? "border-foreground bg-foreground text-surface-raised"
                : "border-line bg-surface-soft text-foreground hover:bg-surface"
            }`}
          >
            <IconoTrazo d={ICONO_INFO} className="h-5 w-5" />
          </button>
        ) : null}
      </div>
      {!estado ? (
        <p className={`rounded-xl border px-3 py-3 text-sm text-muted ${tono}`}>
          No se pudo consultar el estado del cliente en SAP.
        </p>
      ) : (
        <>
          {/* Columnas a medida: la deuda necesita más lugar que el estado y la cantidad de facturas. */}
          <dl className={`grid grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)_minmax(0,0.85fr)] divide-x divide-line rounded-xl border ${tono}`}>
            <div className="min-w-0 space-y-1.5 px-2 py-3 sm:px-3">
              <dt className="text-xs text-muted sm:text-sm">Estado</dt>
              <dd>
                <span
                  className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-1 text-xs font-bold sm:px-2.5 sm:text-sm ${
                    t!.pildora
                  }`}
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="hidden h-4 w-4 sm:block" aria-hidden>
                    {estado.tipo === "ok" ? (
                      <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm3.86-9.81a.75.75 0 0 0-1.22-.88l-3.24 4.5-1.6-1.6a.75.75 0 1 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.09l3.73-5.24z" clipRule="evenodd" />
                    ) : (
                      <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                    )}
                  </svg>
                  {estado.texto}
                </span>
              </dd>
            </div>
            <div className="min-w-0 space-y-1 px-2 py-3 sm:px-3">
              <dt className="text-xs text-muted sm:text-sm">Deuda pendiente</dt>
              <dd className="break-words text-base font-extrabold tabular-nums text-foreground sm:text-2xl">
                {!c ? "—" : c.facturasPendientes ? c.montosPendientes.join(" · ") : "Gs. 0"}
              </dd>
            </div>
            <div className="min-w-0 space-y-1 px-2 py-3 sm:px-3">
              <dt className="text-xs text-muted sm:text-sm">Facturas pendientes</dt>
              <dd className="text-base font-extrabold tabular-nums text-foreground sm:text-2xl">
                {c ? c.facturasPendientes : "—"}
              </dd>
            </div>
          </dl>
          <dl id={motivoId} hidden={!verMotivo} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 rounded-xl border border-line bg-surface px-3 py-2.5 text-sm">
            <dt className="text-muted">Descripción</dt>
            <dd className={`break-words font-semibold ${t!.texto}`}>
              {estado.motivo}
            </dd>
            <dt className="text-muted">Deuda</dt>
            <dd className="break-words text-foreground">
              {!c ? "—" : c.facturasPendientes ? c.montosPendientes.join(" · ") : "Sin deuda"}
            </dd>
            <dt className="text-muted">Deuda desde el</dt>
            <dd className="text-foreground">{c?.fechaFacturaInhabilitante ?? "—"}</dd>
          </dl>
        </>
      )}
    </section>
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
            {[d.sap.DocumentLines[0]?.WarehouseCode, d.errorSap]
              .filter(Boolean)
              .join(": ")}
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
