"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Modal } from "@/components/modal";
import { PantallaCarga } from "@/components/pantalla-carga";
import { usePanel } from "@/components/panel/contexto";
import { btnGhost, errorBox, inputBase } from "@/components/ui";
import { TopBar } from "@/components/campo/ui/top-bar";
import { mensajeError } from "@/utils/error";
import { normalizarBusqueda } from "@/utils/texto";
import {
  ALERTAS_ORGANIGRAMA,
  armarArbol,
  caminoHasta,
  cumpleFiltros,
  estadoHoy,
  filtrarArbol,
  SIN_FILTROS,
} from "@/utils/organigrama";
import type {
  FiltrosOrganigrama,
  NodoOrganigrama,
  Organigrama,
  PersonaOrganigrama,
} from "@/types/organigrama";
import type { MetaUsuarios } from "@/types/usuario";
import styles from "./organigrama.module.css";

const ZOOM_MIN = 0.2;
const ZOOM_MAX = 2.5;

const fechaCorta = (iso: string) => iso.split("-").reverse().join("/");

function Chevron() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      width="14"
      height="14"
      fill="currentColor"
    >
      <path d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" />
    </svg>
  );
}

function Tarjeta({
  nodo,
  raiz,
  resaltado,
  onAbrir,
}: {
  nodo: NodoOrganigrama;
  raiz: boolean;
  resaltado: boolean;
  onAbrir: (p: PersonaOrganigrama) => void;
}) {
  const p = nodo.persona;
  const estado = estadoHoy(p);
  return (
    <button
      type="button"
      id={`org-${p.id}`}
      className={styles.tarjeta}
      data-equipo={p.equipo?.tipo}
      data-inactivo={!p.activo || undefined}
      data-resaltado={resaltado || undefined}
      data-raiz={raiz || undefined}
      data-contexto={nodo.contexto || undefined}
      onClick={() => onAbrir(p)}
      aria-label={`${p.nombre}, ${p.rol ?? "sin rol"}. ${estado.texto}. Ver ficha`}
    >
      <span className={styles.cabeza}>
        <span className={styles.avatar} aria-hidden>
          {p.iniciales || "?"}
        </span>
        <span className={styles.identidad}>
          <strong>{p.nombre}</strong>
          <span>{p.rol ?? "Sin rol"}</span>
          {p.usuario ? <span>@{p.usuario}</span> : null}
        </span>
      </span>
      <span className={styles.chips}>
        {p.equipo ? (
          <span className={styles.chip}>{p.equipo.nombre}</span>
        ) : null}
        <span className={styles.chip} data-tono={estado.tono}>
          <span className={styles.punto} aria-hidden />
          {estado.texto}
        </span>
      </span>
      <span className={styles.pie}>
        <span>
          {p.hoy.locales} {p.hoy.locales === 1 ? "local" : "locales"} hoy ·{" "}
          {p.hoy.visitas} {p.hoy.visitas === 1 ? "visita" : "visitas"}
          {nodo.total ? ` · ${nodo.total} a cargo` : ""}
        </span>
        {p.alertas.length ? (
          <span
            className={styles.alerta}
            title={p.alertas
              .map((a) => ALERTAS_ORGANIGRAMA[a].titulo)
              .join(", ")}
          >
            ⚠ {p.alertas.length}
          </span>
        ) : null}
      </span>
    </button>
  );
}

function Rama({
  nodo,
  raiz,
  abiertos,
  resaltados,
  onPlegar,
  onAbrir,
}: {
  nodo: NodoOrganigrama;
  raiz: boolean;
  abiertos: Set<number>;
  resaltados: Set<number>;
  onPlegar: (id: number) => void;
  onAbrir: (p: PersonaOrganigrama) => void;
}) {
  const abierto = abiertos.has(nodo.persona.id);
  const hojas = nodo.hijos.every((h) => h.hijos.length === 0);
  return (
    <li>
      <Tarjeta
        nodo={nodo}
        raiz={raiz}
        resaltado={resaltados.has(nodo.persona.id)}
        onAbrir={onAbrir}
      />
      {nodo.hijos.length ? (
        <button
          type="button"
          className={styles.plegar}
          aria-expanded={abierto}
          aria-label={`${abierto ? "Ocultar" : "Mostrar"} las ${nodo.hijos.length} personas a cargo de ${nodo.persona.nombre}`}
          onClick={() => onPlegar(nodo.persona.id)}
        >
          <Chevron /> {nodo.hijos.length}
        </button>
      ) : null}
      {abierto && nodo.hijos.length ? (
        <ul className={hojas ? styles.hojas : undefined}>
          {nodo.hijos.map((h) => (
            <Rama
              key={h.persona.id}
              nodo={h}
              raiz={false}
              abiertos={abiertos}
              resaltados={resaltados}
              onPlegar={onPlegar}
              onAbrir={onAbrir}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/** Ids con personas a cargo hasta cierta profundidad (para abrir al cargar). */
function conHijos(
  nodos: NodoOrganigrama[],
  hasta: number,
  nivel = 0,
  ids = new Set<number>(),
) {
  for (const n of nodos)
    if (n.hijos.length && nivel < hasta) {
      ids.add(n.persona.id);
      conHijos(n.hijos, hasta, nivel + 1, ids);
    }
  return ids;
}

/** Ancho y alto reales (sin zoom) de lo desplegado: une las ramas de primer nivel. */
function tamanoNatural(contenido: HTMLElement, zoom: number) {
  const ramas = [
    ...contenido.querySelectorAll<HTMLElement>(":scope > ul > li"),
  ].map((li) => li.getBoundingClientRect());
  const caja = contenido.getBoundingClientRect();
  const ancho = ramas.length
    ? Math.max(...ramas.map((r) => r.right)) -
      Math.min(...ramas.map((r) => r.left))
    : caja.width;
  return { ancho: ancho / zoom, alto: caja.height / zoom };
}

// Imagen del organigrama tal como está desplegado, a tamaño real.
async function capturar(contenido: HTMLElement, zoom: number) {
  const { toJpeg } = await import("html-to-image");
  const caja = contenido.getBoundingClientRect();
  const width = Math.ceil(caja.width / zoom);
  const height = Math.ceil(caja.height / zoom);
  // Los navegadores no dibujan lienzos de más de ~16.000 px por lado.
  const pixelRatio = Math.max(
    0.5,
    Math.min(2, 15000 / Math.max(width, height)),
  );
  const fondo =
    getComputedStyle(document.documentElement)
      .getPropertyValue("--surface")
      .trim() || "#ffffff";
  return toJpeg(contenido, {
    quality: 0.92,
    pixelRatio,
    width,
    height,
    backgroundColor: fondo,
    style: { zoom: "1" },
  });
}

// PDF sin librerías: la imagen en un iframe oculto y el diálogo de impresión
// del navegador, donde se elige «Guardar como PDF».
function imprimir(imagen: string, titulo: string) {
  const iframe = document.createElement("iframe");
  iframe.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.append(iframe);
  const doc = iframe.contentDocument!;
  doc.open();
  doc.write(
    '<!doctype html><meta charset=utf-8><style>@page{size:landscape;margin:8mm}html,body{margin:0}img{display:block;max-width:100%;max-height:100vh;margin:auto;object-fit:contain}</style><img alt="">',
  );
  doc.close();
  doc.title = titulo;
  const img = doc.querySelector("img")!;
  img.onload = () => {
    iframe.contentWindow!.onafterprint = () =>
      setTimeout(() => iframe.remove(), 500);
    iframe.contentWindow!.print();
    setTimeout(() => iframe.isConnected && iframe.remove(), 60_000);
  };
  img.src = imagen;
}

const FILTROS_HOY: [FiltrosOrganigrama["hoy"], string][] = [
  ["", "Hoy: todos"],
  ["marco", "Marcaron hoy"],
  ["curso", "En un local ahora"],
  ["sin", "Sin marcar hoy"],
  ["baja", "Inactivos"],
];

/**
 * Organigrama de la empresa (superadmin) o del equipo propio (Presentismo):
 * quién está a cargo de quién, qué hizo cada uno hoy y qué jerarquías hacen
 * que alguien no aparezca en el Presentismo de su líder.
 */
export function OrganigramaPanel() {
  const router = useRouter();
  const { usuario } = usePanel();
  const [empresas, setEmpresas] = useState<{ id: number; nombre: string }[]>(
    [],
  );
  const [empresaId, setEmpresaId] = useState<number | null>(null);
  const [datos, setDatos] = useState<Organigrama | null>(null);
  const [error, setError] = useState("");
  const [recarga, setRecarga] = useState(0);
  // Carga en curso = la última consulta terminada no es la pedida.
  const consulta = `${empresaId}|${recarga}`;
  const [terminada, setTerminada] = useState("");
  const cargando = terminada !== consulta;
  const [abiertos, setAbiertos] = useState<Set<number>>(new Set());
  const [busqueda, setBusqueda] = useState("");
  const [herramientasAbiertas, setHerramientasAbiertas] = useState(false);
  const [filtros, setFiltros] = useState<FiltrosOrganigrama>(SIN_FILTROS);
  // En celular arranca un poco más chico para ver más de una rama.
  const [zoom, setZoom] = useState(() =>
    window.matchMedia("(max-width: 639px)").matches ? 0.8 : 1,
  );
  const zoomRef = useRef(zoom);
  const [completa, setCompleta] = useState(false);
  const [verAlertas, setVerAlertas] = useState(false);
  const [exportando, setExportando] = useState("");
  const [ficha, setFicha] = useState<PersonaOrganigrama | null>(null);
  const lienzoRef = useRef<HTMLDivElement>(null);
  const contenidoRef = useRef<HTMLDivElement>(null);
  const arrastre = useRef<{
    id: number;
    x: number;
    y: number;
    left: number;
    top: number;
    movido: boolean;
  } | null>(null);
  const sinClick = useRef(false);

  useEffect(() => {
    if (!usuario.esSuperadmin) return;
    apiFetch<MetaUsuarios>("/admin/usuarios/meta")
      .then((m) => setEmpresas(m.empresas))
      .catch(() => undefined);
  }, [usuario.esSuperadmin]);

  useEffect(() => {
    const control = new AbortController();
    apiFetch<Organigrama>(
      `/campo/organigrama${empresaId ? `?empresaId=${empresaId}` : ""}`,
      {
        signal: control.signal,
      },
    )
      .then((d) => {
        setDatos(d);
        setError("");
        setFiltros(SIN_FILTROS);
        const arbol = armarArbol(d.personas, d.raizId);
        setAbiertos(conHijos(arbol, d.personas.length <= 60 ? Infinity : 2));
      })
      .catch((e: unknown) => {
        if (!control.signal.aborted)
          setError(mensajeError(e, "No se pudo cargar el organigrama"));
      })
      .finally(() => {
        if (!control.signal.aborted) setTerminada(consulta);
      });
    return () => control.abort();
  }, [empresaId, consulta]);

  // Zoom que deja quieto el punto bajo el cursor (o el centro de la vista).
  const cambiarZoom = useCallback(
    (valor: number, foco?: { x: number; y: number }) => {
      const el = lienzoRef.current;
      const actual = zoomRef.current;
      const nuevo = Math.min(
        ZOOM_MAX,
        Math.max(ZOOM_MIN, Math.round(valor * 100) / 100),
      );
      if (!el || nuevo === actual) return;
      const caja = el.getBoundingClientRect();
      const fx = (foco?.x ?? caja.left + el.clientWidth / 2) - caja.left;
      const fy = (foco?.y ?? caja.top + el.clientHeight / 2) - caja.top;
      const x = (el.scrollLeft + fx) / actual;
      const y = (el.scrollTop + fy) / actual;
      zoomRef.current = nuevo;
      setZoom(nuevo);
      requestAnimationFrame(() => {
        el.scrollLeft = x * nuevo - fx;
        el.scrollTop = y * nuevo - fy;
      });
    },
    [],
  );

  // Ctrl/⌘ + rueda (y el pellizco del trackpad) acerca y aleja el organigrama
  // en vez de la página: necesita un listener no pasivo.
  useEffect(() => {
    const el = lienzoRef.current;
    if (!el) return;
    const rueda = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      cambiarZoom(zoomRef.current * (e.deltaY < 0 ? 1.1 : 1 / 1.1), {
        x: e.clientX,
        y: e.clientY,
      });
    };
    el.addEventListener("wheel", rueda, { passive: false });
    return () => el.removeEventListener("wheel", rueda);
  }, [datos, cambiarZoom]);

  // Pantalla completa del navegador si existe; si no (iPhone), la vista ocupa
  // toda la ventana igual. Esc vuelve.
  useEffect(() => {
    if (!completa) return;
    const cambio = () => {
      if (!document.fullscreenElement) setCompleta(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (
        e.key === "Escape" &&
        !document.fullscreenElement &&
        !ficha &&
        !verAlertas
      )
        setCompleta(false);
    };
    document.addEventListener("fullscreenchange", cambio);
    window.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("fullscreenchange", cambio);
      window.removeEventListener("keydown", tecla);
    };
  }, [completa, ficha, verAlertas]);

  function alternarCompleta() {
    if (completa) {
      setCompleta(false);
      if (document.fullscreenElement)
        void document.exitFullscreen().catch(() => undefined);
      return;
    }
    setCompleta(true);
    void document.documentElement.requestFullscreen?.().catch(() => undefined);
  }

  const personas = useMemo(() => datos?.personas ?? [], [datos]);
  const arbol = useMemo(
    () => (datos ? armarArbol(datos.personas, datos.raizId) : []),
    [datos],
  );
  const porId = useMemo(
    () => new Map(personas.map((p) => [p.id, p])),
    [personas],
  );
  const aCargo = useMemo(() => {
    const m = new Map<number, number>();
    const contar = (n: NodoOrganigrama) => {
      m.set(n.persona.id, n.total);
      n.hijos.forEach(contar);
    };
    arbol.forEach(contar);
    return m;
  }, [arbol]);
  const conFiltros = !!(
    filtros.equipo ||
    filtros.rol ||
    filtros.hoy ||
    filtros.alertas
  );
  const visible = useMemo(
    () =>
      conFiltros
        ? filtrarArbol(arbol, (p) => cumpleFiltros(p, filtros))
        : arbol,
    [arbol, filtros, conFiltros],
  );
  const coinciden = conFiltros
    ? personas.filter((p) => cumpleFiltros(p, filtros)).length
    : personas.length;
  const equipos = useMemo(
    () =>
      [
        ...new Set(
          personas.flatMap((p) => (p.equipo ? [p.equipo.nombre] : [])),
        ),
      ].sort(),
    [personas],
  );
  const roles = useMemo(
    () => [...new Set(personas.flatMap((p) => (p.rol ? [p.rol] : [])))].sort(),
    [personas],
  );

  // Al filtrar se abre todo lo que queda, para que se vea a quien coincide.
  function cambiarFiltros(nuevos: FiltrosOrganigrama) {
    setFiltros(nuevos);
    setAbiertos(
      conHijos(
        filtrarArbol(arbol, (p) => cumpleFiltros(p, nuevos)),
        Infinity,
      ),
    );
  }

  const texto = normalizarBusqueda(busqueda.trim());
  const coincidencias = useMemo(
    () =>
      texto
        ? personas.filter((p) =>
            normalizarBusqueda(
              `${p.nombre} ${p.rol ?? ""} ${p.usuario ?? ""} ${p.equipo?.nombre ?? ""}`,
            ).includes(texto),
          )
        : [],
    [personas, texto],
  );
  const resaltados = useMemo(
    () => new Set(coincidencias.map((p) => p.id)),
    [coincidencias],
  );

  const conAlertas = personas.filter((p) => p.alertas.length);

  // Abre las ramas hasta la persona y la deja a la vista.
  function enfocar(id: number) {
    const persona = porId.get(id);
    if (conFiltros && persona && !cumpleFiltros(persona, filtros))
      setFiltros(SIN_FILTROS);
    setAbiertos((actual) => new Set([...actual, ...caminoHasta(personas, id)]));
    requestAnimationFrame(() =>
      document
        .getElementById(`org-${id}`)
        ?.scrollIntoView({
          block: "center",
          inline: "center",
          behavior: "smooth",
        }),
    );
  }

  function buscar(valor: string) {
    setBusqueda(valor);
    const t = normalizarBusqueda(valor.trim());
    if (!t) return;
    const primera = personas.find((p) =>
      normalizarBusqueda(
        `${p.nombre} ${p.rol ?? ""} ${p.usuario ?? ""} ${p.equipo?.nombre ?? ""}`,
      ).includes(t),
    );
    if (primera) enfocar(primera.id);
  }

  function ajustar() {
    const el = lienzoRef.current;
    const contenido = contenidoRef.current;
    if (!el || !contenido) return;
    const { ancho, alto } = tamanoNatural(contenido, zoomRef.current);
    cambiarZoom(Math.min(el.clientWidth / ancho, el.clientHeight / alto, 1));
    requestAnimationFrame(() =>
      requestAnimationFrame(() => el.scrollTo({ left: 0, top: 0 })),
    );
  }

  async function exportar(formato: "jpg" | "pdf") {
    const contenido = contenidoRef.current;
    if (!contenido || !datos) return;
    setExportando(formato === "jpg" ? "Generando imagen" : "Preparando PDF");
    try {
      const imagen = await capturar(contenido, zoomRef.current);
      const nombre = `Organigrama ${datos.raizId === null ? datos.empresa.nombre : "de mi equipo"} ${datos.hoy}`;
      if (formato === "pdf") imprimir(imagen, nombre);
      else {
        const enlace = document.createElement("a");
        enlace.href = imagen;
        enlace.download = `${nombre.replace(/[^\p{L}\p{N} _-]/gu, "").trim()}.jpg`;
        enlace.click();
      }
    } catch (e) {
      setError(mensajeError(e, "No se pudo exportar el organigrama"));
    } finally {
      setExportando("");
    }
  }

  const superior = ficha?.superiorId ? porId.get(ficha.superiorId) : undefined;
  const directos = ficha
    ? personas.filter((p) => p.superiorId === ficha.id)
    : [];
  const btnHerramienta = `${btnGhost} min-h-11 whitespace-nowrap`;
  const selectFiltro = `${inputBase} min-h-11 w-auto max-w-48`;

  return (
    <div className="min-w-0 w-full">
      <TopBar
        title="Organigrama"
        subtitle={
          datos
            ? `${datos.raizId === null ? datos.empresa.nombre : "Tu equipo"} · hoy ${fechaCorta(datos.hoy)} · ${personas.length} ${personas.length === 1 ? "persona" : "personas"}`
            : "Quién está a cargo de quién"
        }
        onBack={() => router.back()}
        right={
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {usuario.esSuperadmin && empresas.length > 1 ? (
              <label className="flex min-w-0 items-center gap-2 text-sm">
                <span className="sr-only">Empresa</span>
                <select
                  value={empresaId ?? datos?.empresa.id ?? ""}
                  onChange={(e) => setEmpresaId(Number(e.target.value))}
                  className={`${inputBase} min-h-11 w-auto max-w-56`}
                >
                  {empresas.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nombre}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <button
              type="button"
              className={`${btnGhost} grid h-11 w-11 place-items-center p-0`}
              onClick={() => setRecarga((n) => n + 1)}
              disabled={cargando}
              aria-label="Actualizar organigrama"
              title="Actualizar organigrama"
            >
              <svg
                viewBox="0 0 24 24"
                className={`h-5 w-5 ${cargando ? "animate-spin" : ""}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M20 7v5h-5M4 17v-5h5" />
                <path d="M5.6 9a7 7 0 0 1 11.55-2.6L20 12M4 12l2.85 5.6A7 7 0 0 0 18.4 15" />
              </svg>
            </button>
          </div>
        }
      />
      <PantallaCarga
        visible={cargando || !!exportando}
        mensaje={exportando || "Cargando organigrama"}
      />

      <div className="mx-auto w-full min-w-0 max-w-7xl space-y-3 px-4 py-4 sm:px-6 lg:px-8">
        {error ? (
          <div className={errorBox}>
            {error}{" "}
            <button
              type="button"
              className={btnGhost}
              onClick={() => setRecarga((n) => n + 1)}
            >
              Reintentar
            </button>
          </div>
        ) : null}

        {datos ? (
          <>
            <section
              aria-label="Organigrama"
              className={
                completa
                  ? "fixed inset-0 z-[1000] flex flex-col gap-2 bg-surface p-2 sm:p-3"
                  : "space-y-2"
              }
            >
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <label className="min-w-0 flex-1 basis-56">
                  <span className="sr-only">Buscar persona</span>
                  <input
                    type="search"
                    value={busqueda}
                    onChange={(e) => buscar(e.target.value)}
                    placeholder="Buscar por nombre, rol, usuario o equipo"
                    className={`${inputBase} min-h-11`}
                  />
                </label>
                <button
                  type="button"
                  className={`${btnGhost} inline-flex min-h-11 items-center gap-2 whitespace-nowrap`}
                  onClick={() => setHerramientasAbiertas((abierto) => !abierto)}
                  aria-expanded={herramientasAbiertas}
                  aria-controls="organigrama-herramientas"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M4 6h16M7 12h10m-7 6h4" />
                  </svg>
                  Filtros y acciones
                  {conFiltros ? (
                    <span
                      className="h-2 w-2 rounded-full bg-accent"
                      title="Hay filtros activos"
                      aria-label="Hay filtros activos"
                    />
                  ) : null}
                  <svg
                    viewBox="0 0 20 20"
                    className={`h-4 w-4 transition-transform ${herramientasAbiertas ? "rotate-180" : ""}`}
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 0 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
                <span className="text-xs text-muted" role="status">
                  {texto
                    ? `${coincidencias.length} ${coincidencias.length === 1 ? "coincidencia" : "coincidencias"}`
                    : conFiltros
                      ? `${coinciden} de ${personas.length}`
                      : `${personas.length} ${personas.length === 1 ? "persona" : "personas"}`}
                </span>
              </div>

              <div
                id="organigrama-herramientas"
                hidden={!herramientasAbiertas}
                className="space-y-3 rounded-xl border border-line bg-surface-raised p-3"
              >
                  <div
                    className="flex min-w-0 flex-wrap items-center gap-2"
                    aria-label="Filtros del organigrama"
                  >
                    <label className="min-w-0">
                      <span className="sr-only">Equipo</span>
                      <select
                        value={filtros.equipo}
                        onChange={(e) =>
                          cambiarFiltros({ ...filtros, equipo: e.target.value })
                        }
                        className={selectFiltro}
                      >
                        <option value="">Todos los equipos</option>
                        {equipos.map((e) => (
                          <option key={e} value={e}>
                            {e}
                          </option>
                        ))}
                        <option value="-">Sin equipo operativo</option>
                      </select>
                    </label>
                    <label className="min-w-0">
                      <span className="sr-only">Rol</span>
                      <select
                        value={filtros.rol}
                        onChange={(e) =>
                          cambiarFiltros({ ...filtros, rol: e.target.value })
                        }
                        className={selectFiltro}
                      >
                        <option value="">Todos los roles</option>
                        {roles.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="min-w-0">
                      <span className="sr-only">Estado de hoy</span>
                      <select
                        value={filtros.hoy}
                        onChange={(e) =>
                          cambiarFiltros({
                            ...filtros,
                            hoy: e.target.value as FiltrosOrganigrama["hoy"],
                          })
                        }
                        className={selectFiltro}
                      >
                        {FILTROS_HOY.map(([valor, etiqueta]) => (
                          <option key={valor} value={valor}>
                            {etiqueta}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface-raised px-3 text-sm hover:bg-surface-soft">
                      <input
                        type="checkbox"
                        checked={filtros.alertas}
                        onChange={(e) =>
                          cambiarFiltros({
                            ...filtros,
                            alertas: e.target.checked,
                          })
                        }
                      />
                      Solo con alertas
                    </label>
                    {conFiltros ? (
                      <button
                        type="button"
                        className={btnHerramienta}
                        onClick={() => setFiltros(SIN_FILTROS)}
                      >
                        Limpiar filtros
                      </button>
                    ) : null}
                  </div>

                  <div
                    className="flex min-w-0 flex-wrap items-center gap-2"
                    role="toolbar"
                    aria-label="Herramientas del organigrama"
                  >
                    {conAlertas.length ? (
                      <button
                        type="button"
                        onClick={() => setVerAlertas(true)}
                        className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-amber-300 bg-amber-50 px-3 text-sm font-semibold text-amber-950 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100 dark:hover:bg-amber-900"
                      >
                        ⚠ {conAlertas.length}{" "}
                        {conAlertas.length === 1 ? "alerta" : "alertas"}
                      </button>
                    ) : null}
                    <div
                      className="flex items-center gap-1"
                      role="group"
                      aria-label="Zoom"
                    >
                      <button
                        type="button"
                        className={btnHerramienta}
                        aria-label="Alejar"
                        disabled={zoom <= ZOOM_MIN}
                        onClick={() => cambiarZoom(zoom / 1.25)}
                      >
                        −
                      </button>
                      <button
                        type="button"
                        className={btnHerramienta}
                        onClick={() => cambiarZoom(1)}
                        title="Volver al 100%"
                      >
                        {Math.round(zoom * 100)}%
                      </button>
                      <button
                        type="button"
                        className={btnHerramienta}
                        aria-label="Acercar"
                        disabled={zoom >= ZOOM_MAX}
                        onClick={() => cambiarZoom(zoom * 1.25)}
                      >
                        +
                      </button>
                      <button
                        type="button"
                        className={btnHerramienta}
                        onClick={ajustar}
                        title="Que entre todo en la vista"
                      >
                        Ajustar
                      </button>
                    </div>
                    <button
                      type="button"
                      className={btnHerramienta}
                      onClick={() => setAbiertos(conHijos(visible, Infinity))}
                    >
                      Abrir todo
                    </button>
                    <button
                      type="button"
                      className={btnHerramienta}
                      onClick={() => setAbiertos(new Set())}
                    >
                      Plegar todo
                    </button>
                    <div
                      className="flex items-center gap-1"
                      role="group"
                      aria-label="Exportar lo que está desplegado"
                    >
                      <button
                        type="button"
                        className={btnHerramienta}
                        onClick={() => void exportar("jpg")}
                        disabled={!!exportando}
                      >
                        JPG
                      </button>
                      <button
                        type="button"
                        className={btnHerramienta}
                        onClick={() => void exportar("pdf")}
                        disabled={!!exportando}
                      >
                        PDF
                      </button>
                    </div>
                    <button
                      type="button"
                      className={`${btnHerramienta} ml-auto`}
                      onClick={alternarCompleta}
                      aria-pressed={completa}
                    >
                      {completa
                        ? "Salir de pantalla completa"
                        : "Pantalla completa"}
                    </button>
                  </div>
              </div>

              <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 rounded-full bg-accent"
                    aria-hidden
                  />{" "}
                  Impulsadores
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 rounded-full bg-brand-500"
                    aria-hidden
                  />{" "}
                  Repositores
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 rounded-full bg-muted"
                    aria-hidden
                  />{" "}
                  Sin equipo operativo
                </span>
                <span className="hidden sm:inline">
                  Arrastrá para moverte · Ctrl + rueda para el zoom · Tocá una
                  persona para ver su ficha
                </span>
              </p>

              <div
                ref={lienzoRef}
                className={`${styles.lienzo} ${completa ? styles.completo : ""}`}
                tabIndex={0}
                aria-label="Organigrama: arrastrá para moverte"
                onPointerDown={(e) => {
                  sinClick.current = false;
                  if (e.pointerType !== "mouse" || e.button !== 0) return;
                  const el = e.currentTarget;
                  arrastre.current = {
                    id: e.pointerId,
                    x: e.clientX,
                    y: e.clientY,
                    left: el.scrollLeft,
                    top: el.scrollTop,
                    movido: false,
                  };
                }}
                onPointerMove={(e) => {
                  const a = arrastre.current;
                  if (!a) return;
                  const dx = e.clientX - a.x;
                  const dy = e.clientY - a.y;
                  // Un clic con temblor no es arrastre: abre la ficha igual.
                  if (!a.movido && Math.hypot(dx, dy) < 5) return;
                  if (!a.movido) {
                    a.movido = true;
                    e.currentTarget.setPointerCapture(a.id);
                    e.currentTarget.dataset.arrastrando = "";
                  }
                  e.currentTarget.scrollLeft = a.left - dx;
                  e.currentTarget.scrollTop = a.top - dy;
                }}
                onPointerUp={(e) => {
                  sinClick.current = !!arrastre.current?.movido;
                  arrastre.current = null;
                  delete e.currentTarget.dataset.arrastrando;
                }}
                onPointerCancel={(e) => {
                  arrastre.current = null;
                  delete e.currentTarget.dataset.arrastrando;
                }}
                onClickCapture={(e) => {
                  // Soltar después de arrastrar no abre la ficha de la tarjeta.
                  if (!sinClick.current) return;
                  sinClick.current = false;
                  e.stopPropagation();
                  e.preventDefault();
                }}
              >
                <div
                  ref={contenidoRef}
                  className={styles.contenido}
                  style={{ zoom }}
                >
                  {visible.length ? (
                    <ul className={styles.arbol}>
                      {visible.map((n) => (
                        <Rama
                          key={n.persona.id}
                          nodo={n}
                          raiz
                          abiertos={abiertos}
                          resaltados={resaltados}
                          onPlegar={(id) =>
                            setAbiertos((actual) => {
                              const nuevo = new Set(actual);
                              if (!nuevo.delete(id)) nuevo.add(id);
                              return nuevo;
                            })
                          }
                          onAbrir={setFicha}
                        />
                      ))}
                    </ul>
                  ) : (
                    <p className="p-6 text-center text-sm text-muted">
                      {conFiltros
                        ? "Nadie coincide con los filtros."
                        : "No hay personas para mostrar."}
                    </p>
                  )}
                </div>
              </div>
            </section>
          </>
        ) : null}
      </div>

      {verAlertas ? (
        <Modal
          titulo={`Alertas de jerarquía (${conAlertas.length})`}
          abierto
          onCerrar={() => setVerAlertas(false)}
          hojaMovil
        >
          <div className="min-w-0 space-y-3 text-sm text-foreground">
            <p className="-mt-2 text-muted">
              Estas personas no aparecen (o no ven a nadie) en Presentismo. Se
              corrige en Usuarios, eligiendo su superior y su rol. Tocá una para
              verla en el organigrama.
            </p>
            <ul className="divide-y divide-line">
              {conAlertas.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setVerAlertas(false);
                      enfocar(p.id);
                    }}
                    className="flex min-h-11 w-full cursor-pointer flex-col items-start gap-0.5 rounded-md px-2 py-2 text-left hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  >
                    <strong>{p.nombre}</strong>
                    <span className="text-xs text-muted">
                      {p.rol ?? "Sin rol"} ·{" "}
                      {p.alertas
                        .map((a) => ALERTAS_ORGANIGRAMA[a].titulo)
                        .join(" · ")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {usuario.puedeAdministrarUsuarios ? (
              <Link href="/panel/usuarios" className={btnGhost}>
                Ir a Usuarios
              </Link>
            ) : null}
          </div>
        </Modal>
      ) : null}

      {ficha ? (
        <Modal
          titulo={ficha.nombre}
          abierto
          onCerrar={() => setFicha(null)}
          hojaMovil
        >
          <div className="min-w-0 space-y-4 text-sm text-foreground">
            <p className="-mt-2 text-muted">
              {ficha.rol ?? "Sin rol"}
              {ficha.equipo
                ? ` · ${ficha.equipo.nombre}`
                : " · Sin equipo operativo"}
              {ficha.usuario ? ` · @${ficha.usuario}` : ""}
              {ficha.activo ? "" : " · Inactivo"}
            </p>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                ["Hoy", estadoHoy(ficha).texto],
                ["Locales asignados hoy", String(ficha.hoy.locales)],
                ["Visitas de hoy", String(ficha.hoy.visitas)],
                [
                  "Personas a cargo",
                  `${directos.length} directas · ${aCargo.get(ficha.id) ?? 0} en total`,
                ],
              ].map(([t, v]) => (
                <div
                  key={t}
                  className="rounded-lg border border-line bg-surface-soft p-3"
                >
                  <dt className="text-xs font-bold uppercase tracking-wider text-muted">
                    {t}
                  </dt>
                  <dd className="mt-1 font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">
                Superior
              </p>
              {superior ? (
                <button
                  type="button"
                  className="min-h-11 cursor-pointer font-semibold text-accent-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  onClick={() => {
                    setFicha(null);
                    enfocar(superior.id);
                  }}
                >
                  {superior.nombre} · {superior.rol ?? "Sin rol"}
                </button>
              ) : (
                <p>
                  {datos?.raizId === ficha.id
                    ? "Fuera de esta vista"
                    : "No tiene superior"}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {ficha.celular ? (
                <a href={`tel:${ficha.celular}`} className={btnGhost}>
                  Llamar {ficha.celular}
                </a>
              ) : null}
              <a href={`mailto:${ficha.correo}`} className={btnGhost}>
                {ficha.correo}
              </a>
            </div>
            {ficha.alertas.length ? (
              <ul className="space-y-2" aria-label="Alertas de jerarquía">
                {ficha.alertas.map((a) => (
                  <li
                    key={a}
                    className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
                  >
                    <p className="font-semibold">
                      {ALERTAS_ORGANIGRAMA[a].titulo}
                    </p>
                    <p className="text-xs">{ALERTAS_ORGANIGRAMA[a].detalle}</p>
                  </li>
                ))}
              </ul>
            ) : null}
            {usuario.puedeAdministrarUsuarios ? (
              <Link href="/panel/usuarios" className={btnGhost}>
                Corregir en Usuarios
              </Link>
            ) : null}
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
