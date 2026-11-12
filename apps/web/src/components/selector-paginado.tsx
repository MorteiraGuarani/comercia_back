"use client";

import { SkeletonFilas } from "@/components/skeleton";
import { useEffect, useId, useRef, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import type { OpcionSelector } from "@/types/opcion-selector";
import type { RespuestaPaginada } from "@/types/paginacion";
import { Paginacion } from "@/components/paginacion";
import { PantallaCarga } from "@/components/pantalla-carga";
import { btnGhost, errorBox, inputBase, labelBase } from "@/components/ui";
import { opcionesMasCercanas } from "@/utils/texto";

// shortcut: al tipear se ordenan hasta 50 coincidencias (tope de la API); si no alcanza, ordenar en el servidor.
const MAX_COINCIDENCIAS = 50;

const INPUT_COMPACTO =
  "h-11 w-full min-w-0 rounded-xl border border-line bg-surface-raised px-3 text-base text-foreground outline-none transition-colors placeholder:text-muted hover:border-brand-500 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30 sm:text-sm";

// Montar con key={url} cuando cambie el alcance para reiniciar la paginación.
export function SelectorPaginado<TId extends number | string = number>({
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
  placeholder = "Seleccioná o escribí para buscar",
  compacto = false,
  etiquetaOculta = false,
  limite = buscable ? 5 : 7,
  opcionVacia,
  limpiable = false,
  conDescripcion = false,
}: {
  url: string;
  etiqueta: string;
  value: NoInfer<TId> | "";
  onChange: (id: NoInfer<TId> | "") => void;
  onSeleccionar?: (opcion: OpcionSelector<NoInfer<TId>>) => void;
  seleccionActual?: string;
  vacio?: string;
  required?: boolean;
  excluirId?: NoInfer<TId>;
  buscable?: boolean;
  placeholder?: string;
  /** Para barras de filtros: etiqueta solo para lectores de pantalla, alto de
   *  44 px y desplegable más ancho alineado a la derecha. Solo con buscable. */
  compacto?: boolean;
  /** Solo con buscable: etiqueta solo para lectores de pantalla, con el campo y el desplegable normales. */
  etiquetaOculta?: boolean;
  /** Opciones a la vista: con buscable, 5 sin paginar; sin buscable, 7 por página. */
  limite?: number;
  /** Solo con buscable: primera opción sin ID (p. ej. «Todos»). Escribir no la elige. */
  opcionVacia?: { texto: string; onElegir: () => void };
  /** Solo con buscable: una X dentro del campo deja la selección vacía. */
  limpiable?: boolean;
  /** Solo con buscable: la descripción va en una segunda línea bajo el nombre (p. ej. sucursal y código). */
  conDescripcion?: boolean;
}) {
  const [datos, setDatos] = useState<RespuestaPaginada<
    OpcionSelector<TId>
  > | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(limite);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);
  const [elegida, setElegida] = useState<OpcionSelector<TId> | null>(null);
  const [buscar, setBuscar] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [editando, setEditando] = useState(false);
  const [activa, setActiva] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listaId = useId();
  const buscando = buscable && buscar.trim() !== "";

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
        apiFetch<RespuestaPaginada<OpcionSelector<TId>>>(
          `${url}${url.includes("?") ? "&" : "?"}page=${page}&limit=${buscando ? MAX_COINCIDENCIAS : limit}${buscable ? `&buscar=${encodeURIComponent(buscar.trim())}` : ""}`,
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
  }, [url, page, limit, intento, buscar, buscable, buscando]);

  const disponibles = (datos?.items ?? []).filter(
    (item) => item.id !== excluirId,
  );
  const opciones = buscando
    ? opcionesMasCercanas(
        disponibles,
        (item) => item.nombre ?? item.descripcion ?? "",
        buscar,
        limit,
      )
    : disponibles;
  // null = la opción vacía; va primero mientras no se busca.
  const lista: (OpcionSelector<TId> | null)[] =
    opcionVacia && !buscar.trim() ? [null, ...opciones] : opciones;
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
  function elegir(item: OpcionSelector<TId> | null) {
    setElegida(item);
    if (item) {
      onChange(item.id);
      onSeleccionar?.(item);
    } else opcionVacia?.onElegir();
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
        <label
          className={compacto || etiquetaOculta ? "block min-w-0" : labelBase}
        >
          {compacto || etiquetaOculta ? (
            <span className="sr-only">{etiqueta}</span>
          ) : (
            etiqueta
          )}
          <span className="relative block min-w-0">
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
              className={`${compacto ? INPUT_COMPACTO : inputBase} ${limpiable && value !== "" ? "pr-11" : ""}`}
              value={abierto && editando ? buscar : nombreSeleccionado}
              maxLength={120}
              placeholder={placeholder}
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
                  if (!cargando && !error && lista.length)
                    setActiva((n) =>
                      e.key === "ArrowDown"
                        ? Math.min(n + 1, lista.length - 1)
                        : Math.max(n - 1, 0),
                    );
                }
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (
                    abierto &&
                    !cargando &&
                    !error &&
                    activa >= 0 &&
                    activa < lista.length
                  )
                    elegir(lista[activa]);
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
            {limpiable && value !== "" ? (
              <button
                type="button"
                aria-label={`Quitar ${etiqueta.toLowerCase()}`}
                title={`Quitar ${etiqueta.toLowerCase()}`}
                onClick={(e) => {
                  // Sin esto el clic en la etiqueta reenfoca el campo y abre la lista.
                  e.preventDefault();
                  setElegida(null);
                  onChange("");
                  setAbierto(false);
                }}
                className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 cursor-pointer place-items-center rounded-full text-muted hover:bg-surface-soft hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
              >
                <svg
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-4 w-4"
                  aria-hidden
                >
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            ) : null}
          </span>
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
              const opcion =
                opciones.find(
                  (item) => String(item.id) === evento.target.value,
                ) ?? null;
              const id =
                opcion?.id ??
                (evento.target.value === String(value) ? value : "");
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
              ? compacto
                ? "absolute right-0 top-full z-20 mt-1 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-control-line bg-surface-raised p-2 shadow-lg"
                : "absolute left-0 right-0 top-full z-20 mt-1 rounded-xl border border-control-line bg-surface-raised p-2 shadow-lg"
              : ""
          }
        >
          {buscable ? (
            <>
              {cargando ? (
                <SkeletonFilas etiqueta="Buscando opciones…" className="p-2" />
              ) : (
                <div role="status" className="text-sm text-muted">
                  {!error && opciones.length === 0
                    ? "No se encontraron resultados."
                    : ""}
                </div>
              )}
              <ul
                id={listaId}
                role="listbox"
                aria-label={etiqueta}
                aria-busy={cargando}
                className="max-h-80 overflow-y-auto"
              >
                {!cargando && !error
                  ? lista.map((item, index) => {
                      const id = item ? item.id : "";
                      return (
                        <li
                          key={String(id)}
                          id={`${listaId}-${index}`}
                          role="option"
                          aria-selected={id === value}
                          className={`flex min-h-11 cursor-pointer items-center rounded-lg px-3 py-2 text-sm hover:bg-surface-soft ${activa === index || id === value ? "bg-surface-soft" : ""}`}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => elegir(item)}
                        >
                          {item && conDescripcion && item.nombre && item.descripcion ? (
                            <span className="min-w-0">
                              <span className="block break-words">{item.nombre}</span>
                              <span className="block break-words text-xs text-muted">{item.descripcion}</span>
                            </span>
                          ) : item ? (
                            (item.nombre ?? item.descripcion)
                          ) : (
                            opcionVacia?.texto
                          )}
                        </li>
                      );
                    })
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
          {!buscable && datos && !cargando && !error && datos.totalPages > 1 ? (
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
