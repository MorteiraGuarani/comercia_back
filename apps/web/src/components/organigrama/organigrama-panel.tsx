"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Modal } from "@/components/modal";
import { PantallaCarga } from "@/components/pantalla-carga";
import { usePanel } from "@/components/panel/contexto";
import { btnGhost, errorBox, inputBase } from "@/components/ui";
import { TopBar } from "@/components/campo/ui/top-bar";
import { mensajeError } from "@/utils/error";
import { normalizarBusqueda } from "@/utils/texto";
import { ALERTAS_ORGANIGRAMA, armarArbol, caminoHasta, estadoHoy } from "@/utils/organigrama";
import type { NodoOrganigrama, Organigrama, PersonaOrganigrama } from "@/types/organigrama";
import type { MetaUsuarios } from "@/types/usuario";
import styles from "./organigrama.module.css";

const ZOOM_MIN = 0.4;
const ZOOM_MAX = 1.4;

const fechaCorta = (iso: string) => iso.split("-").reverse().join("/");

function Chevron() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" width="14" height="14" fill="currentColor">
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
        {p.equipo ? <span className={styles.chip}>{p.equipo.nombre}</span> : null}
        <span className={styles.chip} data-tono={estado.tono}>
          <span className={styles.punto} aria-hidden />
          {estado.texto}
        </span>
      </span>
      <span className={styles.pie}>
        <span>
          {p.hoy.locales} {p.hoy.locales === 1 ? "local" : "locales"} hoy · {p.hoy.visitas}{" "}
          {p.hoy.visitas === 1 ? "visita" : "visitas"}
          {nodo.total ? ` · ${nodo.total} a cargo` : ""}
        </span>
        {p.alertas.length ? (
          <span className={styles.alerta} title={p.alertas.map((a) => ALERTAS_ORGANIGRAMA[a].titulo).join(", ")}>
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
      <Tarjeta nodo={nodo} raiz={raiz} resaltado={resaltados.has(nodo.persona.id)} onAbrir={onAbrir} />
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
function conHijos(nodos: NodoOrganigrama[], hasta: number, nivel = 0, ids = new Set<number>()) {
  for (const n of nodos)
    if (n.hijos.length && nivel < hasta) {
      ids.add(n.persona.id);
      conHijos(n.hijos, hasta, nivel + 1, ids);
    }
  return ids;
}

/**
 * Organigrama de la empresa (superadmin) o del equipo propio (Presentismo):
 * quién está a cargo de quién, qué hizo cada uno hoy y qué jerarquías hacen
 * que alguien no aparezca en el Presentismo de su líder.
 */
export function OrganigramaPanel() {
  const router = useRouter();
  const { usuario } = usePanel();
  const [empresas, setEmpresas] = useState<{ id: number; nombre: string }[]>([]);
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
  // En celular arranca un poco más chico para ver más de una rama.
  const [zoom, setZoom] = useState(() => (window.matchMedia("(max-width: 639px)").matches ? 0.8 : 1));
  const [ficha, setFicha] = useState<PersonaOrganigrama | null>(null);
  const arrastre = useRef<{ x: number; y: number; left: number; top: number } | null>(null);

  useEffect(() => {
    if (!usuario.esSuperadmin) return;
    apiFetch<MetaUsuarios>("/admin/usuarios/meta")
      .then((m) => setEmpresas(m.empresas))
      .catch(() => undefined);
  }, [usuario.esSuperadmin]);

  useEffect(() => {
    const control = new AbortController();
    apiFetch<Organigrama>(`/campo/organigrama${empresaId ? `?empresaId=${empresaId}` : ""}`, {
      signal: control.signal,
    })
      .then((d) => {
        setDatos(d);
        setError("");
        const arbol = armarArbol(d.personas, d.raizId);
        setAbiertos(conHijos(arbol, d.personas.length <= 60 ? Infinity : 2));
      })
      .catch((e: unknown) => {
        if (!control.signal.aborted) setError(mensajeError(e, "No se pudo cargar el organigrama"));
      })
      .finally(() => {
        if (!control.signal.aborted) setTerminada(consulta);
      });
    return () => control.abort();
  }, [empresaId, consulta]);

  const personas = useMemo(() => datos?.personas ?? [], [datos]);
  const arbol = useMemo(() => (datos ? armarArbol(datos.personas, datos.raizId) : []), [datos]);
  const porId = useMemo(() => new Map(personas.map((p) => [p.id, p])), [personas]);
  const aCargo = useMemo(() => {
    const m = new Map<number, number>();
    const contar = (n: NodoOrganigrama) => {
      m.set(n.persona.id, n.total);
      n.hijos.forEach(contar);
    };
    arbol.forEach(contar);
    return m;
  }, [arbol]);

  const texto = normalizarBusqueda(busqueda.trim());
  const coincidencias = useMemo(
    () =>
      texto
        ? personas.filter((p) =>
            normalizarBusqueda(`${p.nombre} ${p.rol ?? ""} ${p.usuario ?? ""} ${p.equipo?.nombre ?? ""}`).includes(texto),
          )
        : [],
    [personas, texto],
  );
  const resaltados = useMemo(() => new Set(coincidencias.map((p) => p.id)), [coincidencias]);

  const activos = personas.filter((p) => p.activo);
  const conAlertas = personas.filter((p) => p.alertas.length);
  const kpis = [
    ["Personas activas", activos.length],
    ["Marcaron hoy", activos.filter((p) => p.hoy.entrada).length],
    ["En un local ahora", activos.filter((p) => p.hoy.enCurso).length],
    ["Sin marcar hoy", activos.filter((p) => p.equipo && !p.hoy.entrada).length],
    ["Con alertas", conAlertas.length],
  ] as const;

  // Abre las ramas hasta la persona y la deja a la vista.
  function enfocar(id: number) {
    setAbiertos((actual) => new Set([...actual, ...caminoHasta(personas, id)]));
    requestAnimationFrame(() =>
      document.getElementById(`org-${id}`)?.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" }),
    );
  }

  function buscar(valor: string) {
    setBusqueda(valor);
    const t = normalizarBusqueda(valor.trim());
    if (!t) return;
    const primera = personas.find((p) =>
      normalizarBusqueda(`${p.nombre} ${p.rol ?? ""} ${p.usuario ?? ""} ${p.equipo?.nombre ?? ""}`).includes(t),
    );
    if (primera) enfocar(primera.id);
  }

  const superior = ficha?.superiorId ? porId.get(ficha.superiorId) : undefined;
  const directos = ficha ? personas.filter((p) => p.superiorId === ficha.id) : [];

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
            <button type="button" className={btnGhost} onClick={() => setRecarga((n) => n + 1)} disabled={cargando}>
              Actualizar
            </button>
          </div>
        }
      />
      <PantallaCarga visible={cargando} mensaje="Cargando organigrama" />

      <div className="mx-auto w-full min-w-0 max-w-7xl space-y-4 px-4 py-5 sm:px-6 lg:px-8">
        {error ? (
          <div className={errorBox}>
            {error}{" "}
            <button type="button" className={btnGhost} onClick={() => setRecarga((n) => n + 1)}>
              Reintentar
            </button>
          </div>
        ) : null}

        {datos ? (
          <>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5" aria-label="Resumen del organigrama">
              {kpis.map(([titulo, valor]) => (
                <li key={titulo} className="rounded-xl border border-line bg-surface-raised p-3">
                  <p className="text-2xl font-extrabold text-foreground">{valor}</p>
                  <p className="text-xs font-semibold text-muted">{titulo}</p>
                </li>
              ))}
            </ul>

            {conAlertas.length ? (
              <details
                open
                className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
              >
                <summary className="flex min-h-11 cursor-pointer items-center font-semibold hover:underline">
                  {conAlertas.length} {conAlertas.length === 1 ? "persona necesita" : "personas necesitan"} revisar su jerarquía
                </summary>
                <p className="mb-2 text-xs">
                  Estas personas no aparecen (o no ven a nadie) en Presentismo. Se corrige en Usuarios, eligiendo su superior y su rol.
                </p>
                <ul className="divide-y divide-amber-200 dark:divide-amber-800">
                  {conAlertas.slice(0, 30).map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => enfocar(p.id)}
                        className="flex min-h-11 w-full cursor-pointer flex-wrap items-center gap-x-2 rounded-md px-1 py-1.5 text-left hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus dark:hover:bg-amber-900"
                      >
                        <strong>{p.nombre}</strong>
                        <span className="text-xs">
                          {p.alertas.map((a) => ALERTAS_ORGANIGRAMA[a].titulo).join(" · ")}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                {conAlertas.length > 30 ? <p className="mt-1 text-xs">Se muestran las primeras 30.</p> : null}
              </details>
            ) : null}

            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <label className="min-w-0 flex-1 basis-60">
                <span className="sr-only">Buscar persona</span>
                <input
                  type="search"
                  value={busqueda}
                  onChange={(e) => buscar(e.target.value)}
                  placeholder="Buscar por nombre, rol, usuario o equipo"
                  className={`${inputBase} min-h-11`}
                />
              </label>
              {texto ? (
                <span className="text-sm text-muted" role="status">
                  {coincidencias.length} {coincidencias.length === 1 ? "coincidencia" : "coincidencias"}
                </span>
              ) : null}
              <div className="flex items-center gap-1" role="group" aria-label="Zoom del organigrama">
                <button
                  type="button"
                  className={btnGhost}
                  aria-label="Alejar"
                  disabled={zoom <= ZOOM_MIN}
                  onClick={() => setZoom((z) => Math.max(ZOOM_MIN, Math.round((z - 0.1) * 10) / 10))}
                >
                  −
                </button>
                <button type="button" className={btnGhost} onClick={() => setZoom(1)} aria-label="Tamaño normal">
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  type="button"
                  className={btnGhost}
                  aria-label="Acercar"
                  disabled={zoom >= ZOOM_MAX}
                  onClick={() => setZoom((z) => Math.min(ZOOM_MAX, Math.round((z + 0.1) * 10) / 10))}
                >
                  +
                </button>
              </div>
              <button type="button" className={btnGhost} onClick={() => setAbiertos(conHijos(arbol, Infinity))}>
                Abrir todo
              </button>
              <button type="button" className={btnGhost} onClick={() => setAbiertos(new Set())}>
                Plegar todo
              </button>
            </div>

            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-accent" aria-hidden /> Impulsadores
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-brand-500" aria-hidden /> Repositores
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-muted" aria-hidden /> Sin equipo operativo
              </span>
              <span>Arrastrá el fondo o deslizá para moverte. Tocá una persona para ver su ficha.</span>
            </p>

            <div
              className={styles.lienzo}
              tabIndex={0}
              aria-label="Organigrama"
              onPointerDown={(e) => {
                if (e.pointerType !== "mouse" || (e.target as HTMLElement).closest("button")) return;
                const el = e.currentTarget;
                arrastre.current = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop };
                el.setPointerCapture(e.pointerId);
                el.dataset.arrastrando = "";
              }}
              onPointerMove={(e) => {
                const a = arrastre.current;
                if (!a) return;
                e.currentTarget.scrollLeft = a.left - (e.clientX - a.x);
                e.currentTarget.scrollTop = a.top - (e.clientY - a.y);
              }}
              onPointerUp={(e) => {
                arrastre.current = null;
                delete e.currentTarget.dataset.arrastrando;
              }}
              onPointerCancel={(e) => {
                arrastre.current = null;
                delete e.currentTarget.dataset.arrastrando;
              }}
            >
              <div className={styles.contenido} style={{ zoom }}>
                {arbol.length ? (
                  <ul className={styles.arbol}>
                    {arbol.map((n) => (
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
                  <p className="p-6 text-center text-sm text-muted">No hay personas para mostrar.</p>
                )}
              </div>
            </div>
          </>
        ) : null}
      </div>

      {ficha ? (
        <Modal titulo={ficha.nombre} abierto onCerrar={() => setFicha(null)} hojaMovil>
          <div className="min-w-0 space-y-4 text-sm text-foreground">
            <p className="-mt-2 text-muted">
              {ficha.rol ?? "Sin rol"}
              {ficha.equipo ? ` · ${ficha.equipo.nombre}` : " · Sin equipo operativo"}
              {ficha.usuario ? ` · @${ficha.usuario}` : ""}
              {ficha.activo ? "" : " · Inactivo"}
            </p>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                ["Hoy", estadoHoy(ficha).texto],
                ["Locales asignados hoy", String(ficha.hoy.locales)],
                ["Visitas de hoy", String(ficha.hoy.visitas)],
                ["Personas a cargo", `${directos.length} directas · ${aCargo.get(ficha.id) ?? 0} en total`],
              ].map(([t, v]) => (
                <div key={t} className="rounded-lg border border-line bg-surface-soft p-3">
                  <dt className="text-xs font-bold uppercase tracking-wider text-muted">{t}</dt>
                  <dd className="mt-1 font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">Superior</p>
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
                <p>{datos?.raizId === ficha.id ? "Fuera de esta vista" : "No tiene superior"}</p>
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
                    <p className="font-semibold">{ALERTAS_ORGANIGRAMA[a].titulo}</p>
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
