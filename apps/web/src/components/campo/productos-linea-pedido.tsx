"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Paginacion } from "@/components/paginacion";
import { SelectorPaginado } from "@/components/selector-paginado";
import { btnGhost, errorBox, inputBase } from "@/components/ui";
import type { RespuestaPaginada } from "@/types/paginacion";
import type { ItemPedido, LineaPedido, ProductoPedido } from "@/types/pedido";
import { guaranies } from "@/utils/pedidos";

const botonCantidad =
  "grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-xl border border-control-line bg-surface-soft text-lg font-bold text-foreground transition hover:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-40";

/** Productos de una línea con búsqueda y paginación del servidor. */
export function ProductosLineaPedido({
  cardCode,
  linea,
  nombreLinea,
  items,
  onCantidad,
}: {
  cardCode: string;
  linea: LineaPedido;
  nombreLinea: string;
  items: Record<string, ItemPedido>;
  onCantidad: (producto: ProductoPedido, cantidad: number) => void;
}) {
  const [texto, setTexto] = useState("");
  const [buscar, setBuscar] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(7);
  const [datos, setDatos] = useState<RespuestaPaginada<ProductoPedido> | null>(
    null,
  );
  const [error, setError] = useState("");
  const [intento, setIntento] = useState(0);
  const [elegidos, setElegidos] = useState(0);
  // Los ya cargados van primero. Se fijan al traer cada página, no al tipear,
  // para que la fila no salte (y pierda el foco) mientras se edita la cantidad.
  const [fijados, setFijados] = useState<ProductoPedido[]>([]);
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    const espera = setTimeout(() => {
      setBuscar(texto.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(espera);
  }, [texto]);

  useEffect(() => {
    const control = new AbortController();
    const query = new URLSearchParams({
      cardCode,
      linea,
      page: String(page),
      limit: String(limit),
      ...(buscar ? { buscar } : {}),
    });
    apiFetch<RespuestaPaginada<ProductoPedido>>(`/pedidos/productos?${query}`, {
      signal: control.signal,
    })
      .then((r) => {
        setDatos(r);
        setFijados(
          Object.values(itemsRef.current).filter((i) => i.linea === linea),
        );
        setError("");
      })
      .catch((e: unknown) => {
        if (!control.signal.aborted)
          setError(
            e instanceof Error ? e.message : "No se pudieron traer los productos",
          );
      });
    return () => control.abort();
  }, [cardCode, linea, buscar, page, limit, intento]);

  const cargados = Object.values(items).filter((i) => i.linea === linea);
  const consulta = buscar.toLowerCase();
  const primeros = fijados.filter(
    (p) =>
      !consulta ||
      p.nombre.toLowerCase().includes(consulta) ||
      p.itemCode.toLowerCase().includes(consulta),
  );
  const filas = [
    ...primeros,
    ...(datos?.items ?? []).filter(
      (p) => !primeros.some((f) => f.itemCode === p.itemCode),
    ),
  ];
  const subtotal = cargados.reduce(
    (suma, i) => suma + (i.precio ?? 0) * i.cantidad,
    0,
  );

  return (
    <div className="space-y-3">
      {/* Pantallas grandes: buscador que agrega con 1 unidad y solo lo cargado. */}
      <div className="hidden space-y-3 lg:block">
        <SelectorPaginado<string>
          key={elegidos}
          url={`/pedidos/productos?${new URLSearchParams({ cardCode, linea })}`}
          etiqueta={`Agregar en ${nombreLinea}`}
          etiquetaOculta
          buscable
          value=""
          placeholder={`Buscá en ${nombreLinea.toLowerCase()} por nombre o código`}
          onChange={() => undefined}
          onSeleccionar={(opcion) => {
            // La opción es el producto completo de la API (id = itemCode); el último agregado va arriba.
            const producto = opcion as unknown as ProductoPedido;
            onCantidad(producto, items[producto.itemCode]?.cantidad || 1);
            setElegidos((n) => n + 1);
          }}
        />
        {cargados.length ? (
          <ul
            aria-label={`Cargados en ${nombreLinea}`}
            className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface-raised"
          >
            {[...cargados].reverse().map((i) => (
              <FilaProducto
                key={i.itemCode}
                producto={i}
                cantidad={i.cantidad}
                quitable
                onCantidad={onCantidad}
              />
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl border border-dashed border-line bg-surface-raised px-4 py-6 text-center text-sm text-muted">
            Buscá un producto y elegilo para agregarlo al pedido.
          </p>
        )}
      </div>
      <div className="space-y-3 lg:hidden">
      <input
        type="search"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder={`Buscar en ${nombreLinea.toLowerCase()} o código`}
        aria-label={`Buscar en ${nombreLinea}`}
        autoComplete="off"
        className={inputBase}
      />
      {error ? (
        <div className={errorBox}>
          <p>{error}</p>
          <button
            type="button"
            onClick={() => setIntento((n) => n + 1)}
            className={`${btnGhost} mt-2`}
          >
            Reintentar
          </button>
        </div>
      ) : !datos ? (
        <p className="py-6 text-center text-sm text-muted">Cargando productos…</p>
      ) : !filas.length ? (
        <p className="rounded-2xl border border-dashed border-line bg-surface-raised px-4 py-6 text-center text-sm text-muted">
          {buscar
            ? `No hay productos de ${nombreLinea.toLowerCase()} con «${buscar}».`
            : `No hay productos activos en ${nombreLinea.toLowerCase()}.`}
        </p>
      ) : (
        <ul
          aria-label={`Productos de ${nombreLinea}`}
          className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface-raised"
        >
          {filas.map((p) => (
            <FilaProducto
              key={p.itemCode}
              producto={p}
              cantidad={items[p.itemCode]?.cantidad ?? 0}
              onCantidad={onCantidad}
            />
          ))}
        </ul>
      )}
      {datos && datos.total > 0 ? (
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
      ) : null}
      </div>
      <p className="flex justify-between text-sm text-muted">
        <span>
          {cargados.length} producto{cargados.length === 1 ? "" : "s"} cargado
          {cargados.length === 1 ? "" : "s"}
        </span>
        <span>
          Subtotal{" "}
          <b className="text-foreground">{guaranies(subtotal)}</b>
        </span>
      </p>
    </div>
  );
}

function FilaProducto({
  producto,
  cantidad,
  onCantidad,
  quitable = false,
}: {
  producto: ProductoPedido;
  cantidad: number;
  /** Con × al final para sacar el producto del pedido. */
  quitable?: boolean;
  onCantidad: (producto: ProductoPedido, cantidad: number) => void;
}) {
  // Sin almacén no se puede enviar a SAP: se muestra pero no se agrega.
  const sinAlmacen = producto.almacen === null;
  return (
    <li
      className={`flex items-center gap-3 px-3 py-2.5 ${
        cantidad ? "bg-brand-50 dark:bg-brand-950" : "bg-surface-raised"
      } ${sinAlmacen ? "opacity-60" : ""}`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold leading-snug text-foreground">
          {producto.nombre}
        </p>
        <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted">
          <span className="font-mono">{producto.itemCode}</span>
          <span>
            {producto.precio === null ? "Sin precio" : `${guaranies(producto.precio)} u.`}
          </span>
          {sinAlmacen ? (
            <span className="font-semibold text-red-700 dark:text-red-300">Sin almacén</span>
          ) : null}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => onCantidad(producto, cantidad - 1)}
          disabled={!cantidad}
          aria-label={`Restar ${producto.nombre}`}
          className={botonCantidad}
        >
          −
        </button>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={9999}
          value={cantidad || ""}
          placeholder="0"
          disabled={sinAlmacen}
          onChange={(e) => onCantidad(producto, Number(e.target.value))}
          aria-label={`Cantidad de ${producto.nombre}`}
          className="h-11 w-14 rounded-xl border border-control-line bg-surface-raised text-center text-base font-bold text-foreground outline-none [appearance:textfield] disabled:cursor-not-allowed focus:border-brand-600 focus:ring-2 focus:ring-focus [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <button
          type="button"
          onClick={() => onCantidad(producto, cantidad + 1)}
          disabled={sinAlmacen}
          title={sinAlmacen ? "Sin almacén: no se puede agregar" : undefined}
          aria-label={`Sumar ${producto.nombre}`}
          className={botonCantidad}
        >
          +
        </button>
      </div>
      {quitable ? (
        <button
          type="button"
          onClick={() => onCantidad(producto, 0)}
          aria-label={`Quitar ${producto.nombre}`}
          title="Quitar del pedido"
          className="ml-1 grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-xl text-2xl leading-none text-muted transition hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus dark:hover:bg-red-950/40 dark:hover:text-red-300"
        >
          ×
        </button>
      ) : null}
    </li>
  );
}
