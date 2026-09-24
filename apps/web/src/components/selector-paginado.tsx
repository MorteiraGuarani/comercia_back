"use client";

import { useEffect, useId, useRef, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import type { OpcionSelector } from "@/types/opcion-selector";
import type { RespuestaPaginada } from "@/types/paginacion";
import { Paginacion } from "@/components/paginacion";
import { PantallaCarga } from "@/components/pantalla-carga";
import { btnGhost, errorBox, inputBase, labelBase } from "@/components/ui";

// Montar con key={url} cuando cambie el alcance para reiniciar la paginación.
export function SelectorPaginado({
  url,
  etiqueta,
  value,
  onChange,
  onSeleccionar,
  seleccionActual,
  vacio = "Seleccioná una opción",
  required = false,
  excluirId,
  buscable = false,
}: {
  url: string;
  etiqueta: string;
  value: number | "";
  onChange: (id: number | "") => void;
  onSeleccionar?: (opcion: OpcionSelector) => void;
  seleccionActual?: string;
  vacio?: string;
  required?: boolean;
  excluirId?: number;
  buscable?: boolean;
}) {
  const [datos, setDatos] = useState<RespuestaPaginada<OpcionSelector> | null>(
    null,
  );
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(7);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);
  const [elegida, setElegida] = useState<OpcionSelector | null>(null);
  const [buscar, setBuscar] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [editando, setEditando] = useState(false);
  const [activa, setActiva] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listaId = useId();

  useEffect(() => {
    inputRef.current?.setCustomValidity(
      required && value === "" ? "Seleccioná una opción de la lista." : "",
    );
  }, [required, value]);

  useEffect(() => {
    if (abierto && activa >= 0)
      document
        .getElementById(`${listaId}-${activa}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [abierto, activa, listaId]);

  useEffect(() => {
    let vigente = true;
    const controller = new AbortController();
    const timer = setTimeout(
      () => {
        apiFetch<RespuestaPaginada<OpcionSelector>>(
          `${url}${url.includes("?") ? "&" : "?"}page=${page}&limit=${limit}${buscable ? `&buscar=${encodeURIComponent(buscar.trim())}` : ""}`,
          { signal: controller.signal },
        )
          .then((respuesta) => {
            if (vigente) {
              setDatos(respuesta);
              setError(null);
            }
          })
          .catch((problema) => {
            if (vigente)
              setError(
                problema instanceof ApiError
                  ? problema.message
                  : "No se pudieron cargar las opciones",
              );
          })
          .finally(() => {
            if (vigente) setCargando(false);
          });
      },
      buscable && buscar.trim() ? 300 : 0,
    );
    return () => {
      vigente = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [url, page, limit, intento, buscar, buscable]);

  const opciones = (datos?.items ?? []).filter((item) => item.id !== excluirId);
  const fueraDePagina =
    value !== "" && !opciones.some((item) => item.id === value);
  const seleccion =
    elegida?.id === value
      ? elegida
      : opciones.find((item) => item.id === value);
  const nombreSeleccionado =
    value === ""
      ? ""
      : (seleccion?.nombre ??
        seleccion?.descripcion ??
        seleccionActual ??
        `Seleccionado: ${value}`);
  function abrir() {
    if (abierto) return;
    if (buscar !== "" || page !== 1) setCargando(true);
    setBuscar("");
    setPage(1);
    setEditando(false);
    setActiva(-1);
    setAbierto(true);
  }
  function elegir(item: OpcionSelector) {
    setElegida(item);
    onChange(item.id);
    onSeleccionar?.(item);
    setEditando(false);
    setAbierto(false);
    setActiva(-1);
  }
  return (
    <div
      className="relative w-full min-w-0"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
          setAbierto(false);
          setEditando(false);
        }
      }}
    >
      <PantallaCarga
        visible={cargando && !buscable}
        mensaje={`Cargando ${etiqueta.toLowerCase()}`}
      />
      {buscable ? (
        <label className={labelBase}>
          {etiqueta}
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={abierto}
            aria-controls={listaId}
            aria-activedescendant={
              abierto && !cargando && activa >= 0
                ? `${listaId}-${activa}`
                : undefined
            }
            autoComplete="off"
            required={required}
            className={inputBase}
            value={abierto && editando ? buscar : nombreSeleccionado}
            maxLength={120}
            placeholder="Seleccioná o escribí para buscar"
            onFocus={abrir}
            onClick={abrir}
            onKeyDown={(e) => {
              if (e.key === "Escape" && abierto) {
                e.preventDefault();
                e.stopPropagation();
                setAbierto(false);
                setEditando(false);
              }
              if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                abrir();
                if (!cargando && !error && opciones.length)
                  setActiva((n) =>
                    e.key === "ArrowDown"
                      ? Math.min(n + 1, opciones.length - 1)
                      : Math.max(n - 1, 0),
                  );
              }
              if (e.key === "Enter") {
                e.preventDefault();
                if (abierto && !cargando && !error && opciones[activa])
                  elegir(opciones[activa]);
                else abrir();
              }
            }}
            onChange={(e) => {
              setAbierto(true);
              setEditando(true);
              setActiva(-1);
              onChange("");
              setBuscar(e.target.value);
              setPage(1);
              setCargando(true);
              setError(null);
            }}
          />
        </label>
      ) : null}
      {!buscable ? (
        <label className={labelBase}>
          {etiqueta}
          <select
            className={inputBase}
            value={value}
            required={required}
            disabled={cargando || !!error}
            onChange={(evento) => {
              const id =
                evento.target.value === "" ? "" : Number(evento.target.value);
              const opcion = opciones.find((item) => item.id === id) ?? null;
              setElegida(opcion);
              onChange(id);
              if (opcion) onSeleccionar?.(opcion);
            }}
          >
            <option value="">{vacio}</option>
            {fueraDePagina ? (
              <option value={value}>
                {elegida?.id === value
                  ? (elegida.nombre ?? elegida.descripcion)
                  : (seleccionActual ?? `Seleccionado: ${value}`)}
              </option>
            ) : null}
            {opciones.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nombre ?? item.descripcion}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {!buscable || abierto ? (
        <div
          className={
            buscable
              ? "absolute left-0 right-0 top-full z-20 mt-1 rounded-xl border border-control-line bg-surface-raised p-2 shadow-lg"
              : ""
          }
        >
          {buscable ? (
            <>
              <div role="status" className="text-sm text-muted">
                {cargando
                  ? "Buscando opciones…"
                  : !error && opciones.length === 0
                    ? "No se encontraron resultados."
                    : ""}
              </div>
              <ul
                id={listaId}
                role="listbox"
                aria-label={etiqueta}
                aria-busy={cargando}
                className="max-h-80 overflow-y-auto"
              >
                {!cargando && !error
                  ? opciones.map((item, index) => (
                      <li
                        key={item.id}
                        id={`${listaId}-${index}`}
                        role="option"
                        aria-selected={item.id === value}
                        className={`flex min-h-11 cursor-pointer items-center rounded-lg px-3 py-2 text-sm hover:bg-surface-soft ${activa === index || item.id === value ? "bg-surface-soft" : ""}`}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => elegir(item)}
                      >
                        {item.nombre ?? item.descripcion}
                      </li>
                    ))
                  : null}
              </ul>
            </>
          ) : null}
          {error ? (
            <div className={`${errorBox} mt-2`}>
              <p>{error}</p>
              <button
                type="button"
                className={btnGhost}
                onClick={() => {
                  setCargando(true);
                  setIntento((n) => n + 1);
                }}
              >
                Reintentar
              </button>
            </div>
          ) : null}
          {datos && !cargando && !error && datos.totalPages > 1 ? (
            <Paginacion
              desplazarAlInicio={false}
              page={datos.page}
              limit={datos.limit}
              total={datos.total}
              totalPages={datos.totalPages}
              onPageChange={(pagina) => {
                setActiva(-1);
                setCargando(true);
                setPage(pagina);
              }}
              onLimitChange={(cantidad) => {
                setActiva(-1);
                setCargando(true);
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
