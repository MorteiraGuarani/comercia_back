"use client";

import { useEffect, useState } from "react";
import { Paginacion } from "@/components/paginacion";
import { useListaCampo } from "@/hooks/use-lista-campo";
import { formatoDistancia, metrosEntre } from "@/utils/distancia";
import type { ClientePdv } from "@/types/campo";
import type { PestanaCliente } from "./cliente-modal";
import { TarjetaPdv } from "./tarjeta-pdv";
import {
  IconoBuscar,
  IconoCliente,
  IconoEquipo,
  IconoFlechaDer,
  IconoFlechaIzq,
  IconoTienda,
} from "./ui/iconos-campo";

interface Colaborador {
  id: number;
  nombre: string;
  descripcion: string;
  codigo?: string;
}
type Posicion = { latitud: number; longitud: number };

const MAX_RECIENTES = 3;
const claveRecientes = (usuarioId: number) =>
  `comercia:administracion:recientes:${usuarioId}`;

// Recientes: comodidad de este dispositivo; si no se puede guardar, no pasa nada.
function leerRecientes(usuarioId: number): Colaborador[] {
  try {
    const texto = window.localStorage.getItem(claveRecientes(usuarioId));
    const lista: unknown = texto ? JSON.parse(texto) : [];
    return Array.isArray(lista)
      ? (lista as Colaborador[]).slice(0, MAX_RECIENTES)
      : [];
  } catch {
    return [];
  }
}
function guardarRecientes(usuarioId: number, lista: Colaborador[]) {
  try {
    window.localStorage.setItem(
      claveRecientes(usuarioId),
      JSON.stringify(lista),
    );
  } catch {
    // Almacenamiento bloqueado: los recientes solo duran esta visita.
  }
}

const COLORES_AVATAR = [
  "bg-brand-100 text-brand-800 dark:bg-brand-800 dark:text-brand-50",
  "bg-sky-100 text-sky-800 dark:bg-sky-800 dark:text-sky-50",
  "bg-amber-100 text-amber-900 dark:bg-amber-800 dark:text-amber-50",
  "bg-violet-100 text-violet-800 dark:bg-violet-800 dark:text-violet-50",
];
const iniciales = (nombre: string) =>
  nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

function Avatar({ c }: { c: Colaborador }) {
  return (
    <span
      aria-hidden="true"
      className={`grid h-12 w-12 shrink-0 place-items-center rounded-full text-base font-bold ${COLORES_AVATAR[c.id % COLORES_AVATAR.length]}`}
    >
      {iniciales(c.nombre)}
    </span>
  );
}

function FilaColaborador({
  c,
  onElegir,
}: {
  c: Colaborador;
  onElegir: (c: Colaborador) => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onElegir(c)}
        className="flex min-h-16 w-full min-w-0 cursor-pointer items-center gap-3 rounded-2xl border border-line bg-surface-raised p-3 text-left shadow-[0_2px_8px_rgba(var(--warm-shadow),0.06)] transition-colors hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        <Avatar c={c} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-bold text-foreground">
            {c.nombre}
          </span>
          <span className="block truncate text-sm text-muted">
            {c.descripcion}
            {c.codigo ? (
              <>
                {" "}
                · <span className="font-mono">{c.codigo}</span>
              </>
            ) : null}
          </span>
        </span>
        <IconoFlechaDer className="h-5 w-5 shrink-0 text-muted" />
      </button>
    </li>
  );
}

function Vacio({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="flex min-w-0 items-center gap-4 rounded-2xl border border-brand-100 bg-brand-50/70 p-5 dark:border-brand-900 dark:bg-brand-950/40">
      <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-200">
        <IconoEquipo className="h-8 w-8" />
      </span>
      <div className="min-w-0">
        <p className="text-base font-bold text-foreground">{titulo}</p>
        <p className="mt-1 text-sm leading-relaxed text-muted">{texto}</p>
      </div>
    </div>
  );
}

function Estado({
  error,
  cargando,
  onReintentar,
}: {
  error: string | null;
  cargando: boolean;
  onReintentar: () => void;
}) {
  if (error)
    return (
      <div
        role="alert"
        className="space-y-3 rounded-2xl border border-line bg-surface-raised px-4 py-8 text-center"
      >
        <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        <button
          type="button"
          onClick={onReintentar}
          className="min-h-11 cursor-pointer rounded-lg border border-line px-4 text-sm font-semibold text-foreground hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          Reintentar
        </button>
      </div>
    );
  return cargando ? (
    <p className="py-10 text-center text-sm text-muted">Cargando…</p>
  ) : null;
}

/** Locales de una búsqueda o de un colaborador, con orden por cercanía. */
function ResultadosLocales({
  filtros,
  revision,
  posicion,
  onAbrir,
}: {
  filtros: string;
  revision: number;
  posicion: Posicion | null;
  onAbrir: (local: ClientePdv, pestana: PestanaCliente) => void;
}) {
  const [orden, setOrden] = useState<"cercania" | "nombre">("cercania");
  const cerca = orden === "cercania" && posicion;
  const url = `/campo/locales?${filtros}${cerca ? `${filtros ? "&" : ""}lat=${posicion.latitud}&lng=${posicion.longitud}` : ""}`;
  const lista = useListaCampo<ClientePdv>(url.replace(/\?$/, ""), revision, 7);
  const total = lista.datos?.total ?? 0;
  return (
    <section aria-label="Locales encontrados" className="space-y-3">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <h2 className="text-base font-bold text-foreground">
          Resultados{" "}
          {lista.datos ? (
            <span className="font-normal text-muted">({total})</span>
          ) : null}
        </h2>
        <label className="sr-only" htmlFor="orden-administracion">
          Ordenar locales
        </label>
        <select
          id="orden-administracion"
          value={orden}
          onChange={(e) => {
            setOrden(e.target.value as typeof orden);
            lista.setPage(1);
          }}
          className="h-11 min-w-0 cursor-pointer rounded-xl border border-line bg-surface-raised px-3 text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <option value="cercania" disabled={!posicion}>
            {posicion ? "Más cercanos" : "Más cercanos (sin GPS)"}
          </option>
          <option value="nombre">Por nombre</option>
        </select>
      </div>
      <Estado
        error={lista.error}
        cargando={lista.cargando && !lista.items.length}
        onReintentar={lista.refrescar}
      />
      {!lista.error && lista.datos && !lista.items.length ? (
        <p className="rounded-2xl border border-line bg-surface-raised px-4 py-8 text-center text-sm text-muted">
          No hay locales para esta búsqueda.
        </p>
      ) : null}
      {!lista.error && lista.items.length ? (
        <ul
          className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"
          aria-label="Locales de Administración"
        >
          {lista.items.map((local) => (
            <li key={local.id} className="min-w-0">
              <TarjetaPdv
                local={local}
                sinDetalle
                distancia={
                  posicion && local.latitud !== null && local.longitud !== null
                    ? formatoDistancia(
                        metrosEntre(posicion, {
                          latitud: local.latitud,
                          longitud: local.longitud,
                        }),
                      )
                    : null
                }
                onInformacion={() => onAbrir(local, "datos")}
                onItinerario={() => onAbrir(local, "horarios")}
                onAsignacion={() => onAbrir(local, "personal")}
              />
            </li>
          ))}
        </ul>
      ) : null}
      {!lista.error && total > 0 ? (
        <Paginacion
          page={lista.page}
          totalPages={lista.datos?.totalPages ?? 1}
          total={total}
          limit={lista.limit}
          onPageChange={lista.setPage}
          onLimitChange={lista.setLimit}
        />
      ) : null}
    </section>
  );
}

function ResultadosColaboradores({
  filtros,
  onElegir,
}: {
  filtros: string;
  onElegir: (c: Colaborador) => void;
}) {
  const lista = useListaCampo<Colaborador>(
    `/campo/locales/colaboradores?${filtros}`,
    0,
    7,
  );
  const total = lista.datos?.total ?? 0;
  return (
    <section aria-label="Colaboradores encontrados" className="space-y-3">
      <h2 className="text-base font-bold text-foreground">
        Resultados{" "}
        {lista.datos ? (
          <span className="font-normal text-muted">({total})</span>
        ) : null}
      </h2>
      <Estado
        error={lista.error}
        cargando={lista.cargando && !lista.items.length}
        onReintentar={lista.refrescar}
      />
      {!lista.error && lista.datos && !lista.items.length ? (
        <p className="rounded-2xl border border-line bg-surface-raised px-4 py-8 text-center text-sm text-muted">
          Nadie de tu equipo coincide con la búsqueda.
        </p>
      ) : null}
      {!lista.error && lista.items.length ? (
        <ul className="grid gap-2.5 md:grid-cols-2" aria-label="Colaboradores">
          {lista.items.map((c) => (
            <FilaColaborador key={c.id} c={c} onElegir={onElegir} />
          ))}
        </ul>
      ) : null}
      {!lista.error && total > 0 ? (
        <Paginacion
          page={lista.page}
          totalPages={lista.datos?.totalPages ?? 1}
          total={total}
          limit={lista.limit}
          onPageChange={lista.setPage}
          onLimitChange={lista.setLimit}
        />
      ) : null}
    </section>
  );
}

const MODOS = [
  {
    modo: "colaborador",
    titulo: "Colaborador",
    detalle: "Personas de tu equipo",
    Icono: IconoCliente,
  },
  {
    modo: "local",
    titulo: "Local de venta",
    detalle: "Sucursales y puntos",
    Icono: IconoTienda,
  },
] as const;

/**
 * Administración del supervisor: busca por colaborador (y ve sus locales) o
 * por local de venta. No consulta nada hasta que se busca.
 */
export function AdministracionSupervisor({
  usuarioId,
  revision,
  onAbrir,
}: {
  usuarioId: number;
  revision: number;
  onAbrir: (local: ClientePdv, pestana: PestanaCliente) => void;
}) {
  const [modo, setModo] = useState<"colaborador" | "local">("colaborador");
  const [texto, setTexto] = useState("");
  // null = todavía no buscó en ese modo.
  const [buscadoColaborador, setBuscadoColaborador] = useState<string | null>(
    null,
  );
  const [buscadoLocal, setBuscadoLocal] = useState<string | null>(null);
  const [elegido, setElegido] = useState<Colaborador | null>(null);
  const [recientes, setRecientes] = useState<Colaborador[]>(() =>
    typeof window === "undefined" ? [] : leerRecientes(usuarioId),
  );
  const [posicion, setPosicion] = useState<Posicion | null>(null);

  // La distancia y "Más cercanos" usan la posición del teléfono si la da.
  useEffect(() => {
    const geo = globalThis.navigator?.geolocation;
    if (!geo) return;
    let vigente = true;
    geo.getCurrentPosition(
      (p) => {
        if (vigente)
          setPosicion({
            latitud: p.coords.latitude,
            longitud: p.coords.longitude,
          });
      },
      () => undefined,
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 120_000 },
    );
    return () => {
      vigente = false;
    };
  }, []);

  function elegir(c: Colaborador) {
    setElegido(c);
    const lista = [c, ...recientes.filter((r) => r.id !== c.id)].slice(
      0,
      MAX_RECIENTES,
    );
    setRecientes(lista);
    guardarRecientes(usuarioId, lista);
  }

  const filtrosColaborador = new URLSearchParams({
    buscar: buscadoColaborador ?? "",
  }).toString();
  const filtrosLocal = buscadoLocal
    ? new URLSearchParams({ buscar: buscadoLocal }).toString()
    : "";

  return (
    <div className="space-y-5">
      <div
        className="grid grid-cols-2 gap-2.5"
        role="group"
        aria-label="Buscar por"
      >
        {MODOS.map(({ modo: m, titulo, detalle, Icono }) => {
          const activo = modo === m;
          return (
            <button
              key={m}
              type="button"
              aria-pressed={activo}
              onClick={() => {
                setModo(m);
                setTexto(
                  m === "local"
                    ? (buscadoLocal ?? "")
                    : (buscadoColaborador ?? ""),
                );
              }}
              className={`flex min-h-16 min-w-0 cursor-pointer items-center gap-2.5 rounded-2xl border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus sm:gap-3 sm:px-4 ${
                activo
                  ? "border-brand-600 bg-brand-50 shadow-[inset_0_-3px_0_var(--color-brand-600)] dark:border-brand-500 dark:bg-brand-950/60 dark:shadow-[inset_0_-3px_0_var(--color-brand-500)]"
                  : "border-line bg-surface-soft hover:bg-surface-raised"
              }`}
            >
              <Icono
                className={`h-7 w-7 shrink-0 ${activo ? "text-brand-700 dark:text-brand-300" : "text-foreground"}`}
              />
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-foreground sm:text-[15px]">
                  {titulo}
                </span>
                <span
                  className={`block truncate text-xs ${activo ? "text-brand-800 dark:text-brand-200" : "text-muted"}`}
                >
                  {detalle}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <form
        role="search"
        aria-label={
          modo === "local" ? "Buscar local de venta" : "Buscar colaborador"
        }
        className="flex min-w-0 gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (modo === "local") setBuscadoLocal(texto.trim());
          else {
            setElegido(null);
            setBuscadoColaborador(texto.trim());
          }
        }}
      >
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">
            {modo === "local"
              ? "Local por nombre o código"
              : "Colaborador por nombre o código"}
          </span>
          <IconoBuscar className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
          <input
            type="search"
            name="buscar-administracion"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={
              modo === "local"
                ? "Buscar local por nombre o código"
                : "Buscar colaborador por nombre o código"
            }
            className="h-12 w-full min-w-0 rounded-xl border border-line bg-surface-raised pl-11 pr-3 text-base text-foreground outline-none transition-colors placeholder:text-muted hover:border-brand-500 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30 sm:text-sm"
          />
        </label>
        <button
          type="submit"
          aria-label="Buscar"
          title="Buscar"
          className="grid h-12 w-12 shrink-0 cursor-pointer place-items-center rounded-xl bg-brand-700 text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus dark:bg-brand-600 dark:hover:bg-brand-500"
        >
          <IconoBuscar className="h-5 w-5" />
        </button>
      </form>

      {modo === "colaborador" ? (
        elegido ? (
          <div className="space-y-4">
            <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-line bg-surface-raised p-3">
              <button
                type="button"
                onClick={() => setElegido(null)}
                aria-label="Volver a colaboradores"
                title="Volver"
                className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-xl border border-line text-foreground hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                <IconoFlechaIzq className="h-5 w-5" />
              </button>
              <Avatar c={elegido} />
              <div className="min-w-0">
                <p className="truncate text-[15px] font-bold text-foreground">
                  {elegido.nombre}
                </p>
                <p className="truncate text-sm text-muted">
                  {elegido.descripcion}
                  {elegido.codigo ? ` · ${elegido.codigo}` : ""} · sus locales
                  de hoy
                </p>
              </div>
            </div>
            <ResultadosLocales
              key={`u-${elegido.id}`}
              filtros={new URLSearchParams({
                usuarioId: String(elegido.id),
              }).toString()}
              revision={revision}
              posicion={posicion}
              onAbrir={onAbrir}
            />
          </div>
        ) : (
          <div className="space-y-4">
            {buscadoColaborador !== null ? (
              <ResultadosColaboradores
                key={filtrosColaborador}
                filtros={filtrosColaborador}
                onElegir={elegir}
              />
            ) : (
              <>
                {recientes.length ? (
                  <section
                    aria-label="Colaboradores recientes"
                    className="space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-base font-bold text-foreground">
                        Colaboradores recientes
                      </h2>
                      <button
                        type="button"
                        onClick={() => setBuscadoColaborador("")}
                        className="min-h-11 cursor-pointer rounded-lg px-2 text-sm font-semibold text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus dark:text-brand-300"
                      >
                        Ver todos
                      </button>
                    </div>
                    <ul className="grid gap-2.5 md:grid-cols-2">
                      {recientes.map((c) => (
                        <FilaColaborador key={c.id} c={c} onElegir={elegir} />
                      ))}
                    </ul>
                  </section>
                ) : (
                  <button
                    type="button"
                    onClick={() => setBuscadoColaborador("")}
                    className="min-h-11 cursor-pointer rounded-lg px-1 text-sm font-semibold text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus dark:text-brand-300"
                  >
                    Ver todo el equipo
                  </button>
                )}
                <Vacio
                  titulo="Buscá un colaborador"
                  texto="Ingresá el nombre o código para ver sus locales, horarios y equipo."
                />
              </>
            )}
          </div>
        )
      ) : buscadoLocal !== null ? (
        <ResultadosLocales
          key={`l-${filtrosLocal}`}
          filtros={filtrosLocal}
          revision={revision}
          posicion={posicion}
          onAbrir={onAbrir}
        />
      ) : (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setBuscadoLocal("")}
            className="min-h-11 cursor-pointer rounded-lg px-1 text-sm font-semibold text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus dark:text-brand-300"
          >
            Ver todos los locales
          </button>
          <Vacio
            titulo="Buscá un local de venta"
            texto="Ingresá el nombre o código del local para ver su información, horarios y equipo."
          />
        </div>
      )}
    </div>
  );
}
