"use client";

import { useEffect, useId, useState } from "react";
import { buscarItems } from "@/lib/inventario-db";
import { Paginacion } from "@/components/paginacion";
import { btnGhost, errorBox, inputBase, labelBase } from "@/components/ui";
import { mensajeError } from "@/utils/error";
import { detalleListaPrecio } from "@/utils/inventario";
import type { ItemInventarioLocal } from "@/types/inventario";
import type { RespuestaPaginada } from "@/types/paginacion";

interface SelectorItemInventarioProps {
  empresaId: number;
  // ids (artículo + lista) ya elegidos.
  elegidos: Set<string>;
  // Cambia al renovarse el catálogo para volver a buscar.
  version: number;
  disabled?: boolean;
  // Explica por qué no se puede buscar (sin copia, sin conexión).
  placeholder?: string;
  onElegir: (item: ItemInventarioLocal) => void;
}

// Combobox sobre la copia local del catálogo: funciona sin conexión.
export function SelectorItemInventario({
  empresaId,
  elegidos,
  version,
  disabled = false,
  placeholder = "Elegí o escribí código o nombre",
  onElegir,
}: SelectorItemInventarioProps) {
  const [texto, setTexto] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(7);
  const [activa, setActiva] = useState(-1);
  const [intento, setIntento] = useState(0);
  const [resultado, setResultado] = useState<{
    clave: string;
    datos: RespuestaPaginada<ItemInventarioLocal> | null;
    error: string | null;
  } | null>(null);
  const listaId = useId();
  const clave = JSON.stringify([empresaId, texto, page, limit, version, intento]);
  const cargando = abierto && resultado?.clave !== clave;
  const datos = resultado?.datos ?? null;
  const error = resultado?.clave === clave ? resultado.error : null;
  const opciones = datos?.items ?? [];

  useEffect(() => {
    if (!abierto) return;
    let vigente = true;
    const temporizador = setTimeout(
      () => {
        buscarItems(empresaId, texto, page, limit).then(
          (respuesta) => {
            if (vigente) setResultado({ clave, datos: respuesta, error: null });
          },
          (problema: unknown) => {
            if (vigente)
              setResultado({
                clave,
                datos: null,
                error: mensajeError(problema, "No se pudo buscar en los artículos guardados"),
              });
          },
        );
      },
      texto.trim() ? 150 : 0,
    );
    return () => {
      vigente = false;
      clearTimeout(temporizador);
    };
  }, [abierto, clave, empresaId, texto, page, limit]);

  useEffect(() => {
    if (abierto && activa >= 0)
      document.getElementById(`${listaId}-${activa}`)?.scrollIntoView({ block: "nearest" });
  }, [abierto, activa, listaId]);

  function elegir(item: ItemInventarioLocal) {
    if (elegidos.has(item.id)) return;
    onElegir(item);
    setTexto("");
    setPage(1);
    setActiva(-1);
    setAbierto(false);
  }

  return (
    <div
      className="relative w-full min-w-0"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setAbierto(false);
      }}
    >
      <label className={labelBase}>
        Agregar artículo
        <input
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={abierto}
          aria-controls={listaId}
          aria-activedescendant={abierto && activa >= 0 && opciones[activa] ? `${listaId}-${activa}` : undefined}
          autoComplete="off"
          disabled={disabled}
          className={`${inputBase} disabled:cursor-not-allowed disabled:opacity-50`}
          value={texto}
          maxLength={120}
          placeholder={placeholder}
          onFocus={() => setAbierto(true)}
          onClick={() => setAbierto(true)}
          onChange={(e) => {
            setTexto(e.target.value);
            setPage(1);
            setActiva(-1);
            setAbierto(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape" && abierto) {
              e.preventDefault();
              e.stopPropagation();
              setAbierto(false);
            }
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              setAbierto(true);
              if (opciones.length)
                setActiva((n) =>
                  e.key === "ArrowDown" ? Math.min(n + 1, opciones.length - 1) : Math.max(n - 1, 0),
                );
            }
            if (e.key === "Enter") {
              e.preventDefault();
              if (abierto && !cargando && opciones[activa]) elegir(opciones[activa]);
              else setAbierto(true);
            }
          }}
        />
      </label>
      {abierto ? (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-xl border border-control-line bg-surface-raised p-2 shadow-lg">
          <div role="status" className="text-sm text-muted">
            {cargando && !datos
              ? "Buscando artículos…"
              : !error && datos?.total === 0
                ? texto.trim()
                  ? "No hay artículos que coincidan."
                  : "No hay artículos guardados en este equipo."
                : ""}
          </div>
          <ul id={listaId} role="listbox" aria-label="Artículos" aria-busy={cargando} className="max-h-80 overflow-y-auto">
            {!error
              ? opciones.map((item, index) => {
                  const agregado = elegidos.has(item.id);
                  return (
                    <li
                      key={item.id}
                      id={`${listaId}-${index}`}
                      role="option"
                      aria-selected={activa === index}
                      aria-disabled={agregado || undefined}
                      className={`flex min-h-11 min-w-0 items-center gap-3 rounded-lg px-3 py-2 text-sm ${agregado ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-surface-soft"} ${activa === index ? "bg-surface-soft" : ""}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => elegir(item)}
                    >
                      <span className="shrink-0 font-mono text-xs text-muted">{item.itemcode}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block break-words text-foreground">{item.itemname}</span>
                        <span className="block break-words text-xs text-muted [font-variant-numeric:tabular-nums]">
                          {detalleListaPrecio(item)}
                        </span>
                      </span>
                      {agregado ? (
                        <span className="shrink-0 whitespace-nowrap rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                          Agregado
                        </span>
                      ) : null}
                    </li>
                  );
                })
              : null}
          </ul>
          {error ? (
            <div className={`${errorBox} mt-2`}>
              <p>{error}</p>
              <button type="button" className={btnGhost} onClick={() => setIntento((n) => n + 1)}>
                Reintentar
              </button>
            </div>
          ) : null}
          {datos && !error && datos.totalPages > 1 ? (
            <Paginacion
              desplazarAlInicio={false}
              page={datos.page}
              limit={datos.limit}
              total={datos.total}
              totalPages={datos.totalPages}
              onPageChange={(pagina) => {
                setActiva(-1);
                setPage(pagina);
              }}
              onLimitChange={(cantidad) => {
                setActiva(-1);
                setLimit(cantidad);
                setPage(1);
              }}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
