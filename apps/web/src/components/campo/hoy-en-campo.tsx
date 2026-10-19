"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { apiFetch } from "@/lib/api";
import { usePanel } from "@/components/panel/contexto";
import { Modal } from "@/components/modal";
import { HiloNovedad } from "./hilo-novedad";
import { BarraSegmentos, RAYADO_EN_CURSO } from "./ui/barra-segmentos";
import {
  EncabezadoTablero,
  FilaAtencion,
  ListaAtencion,
  ORDEN_PRESENTISMO,
  PRESENTISMO_UI,
  RUTA_PILL,
  SeccionTablero,
  TarjetaIndicador,
  enfoqueTablero,
} from "./ui/tablero-campo";
import {
  IconoAlerta,
  IconoContacto,
  IconoReloj,
  IconoTareas,
  IconoTelefono,
} from "./ui/iconos-campo";
import { RUTA } from "@/utils/estado-jornada";
import { fechaEnZonaIso, formatoDiaLargo, formatoHora, horaOFechaCorta } from "@/utils/fechas";
import {
  conAlertas,
  filtrarEquipo,
  itemsAtenderAhora,
  ordenarEquipo,
  pct,
  primerNombre,
  requiereAtencion,
} from "@/utils/hoy-en-campo";
import type {
  ColaboradorDetalleData,
  ColaboradorResumen,
  NovedadCampoItem,
  NovedadesResponse,
  PrioridadNovedad,
  SupervisionResumenData,
} from "@/types/campo";
import type {
  FiltroEquipoHoy,
  HojaHoy,
  IndicadorHoy,
  ItemAtencionHoy,
  TonoHoy,
} from "@/types/hoy-en-campo";

// Tablero de inicio de líderes de campo (repositores o impulsadores), de la maqueta
// "Hoy en campo": indicadores tocables, lo que hay que atender y el equipo.

const ACTUALIZAR_CADA_MS = 5 * 60_000;

const PRIORIDAD_UI: Record<PrioridadNovedad, { punto: string; barra: string; etiqueta: string }> = {
  CRITICA: { punto: "bg-red-600 dark:bg-red-400", barra: "bg-red-600 dark:bg-red-500", etiqueta: "Crítica" },
  ALTA: { punto: "bg-amber-500 dark:bg-amber-400", barra: "bg-amber-500 dark:bg-amber-400", etiqueta: "Alta" },
  NORMAL: { punto: "bg-stone-400 dark:bg-stone-500", barra: "bg-stone-400 dark:bg-stone-500", etiqueta: "Normal" },
};

const TITULO_INDICADOR: Record<IndicadorHoy, string> = {
  presentismo: "Presentismo",
  visitas: "Visitas a locales",
  tareas: "Realización de tareas",
  novedades: "Novedades abiertas",
};

const enfoque = enfoqueTablero;
const panel = "rounded-xl border border-line bg-surface-raised p-3 sm:p-4";
const tituloPanel = "mb-2 text-[11px] font-bold uppercase tracking-wide text-muted";

const telefonoValido = (t: string) => t.replace(/[^\d+]/g, "").length >= 6;
const hrefTelefono = (t: string) => `tel:${t.replace(/[^\d+]/g, "")}`;

interface DatosHoy {
  resumen: SupervisionResumenData;
  novedades: NovedadCampoItem[];
  /** null cuando el rol no tiene la página de novedades. */
  abiertas: number | null;
  actualizado: string;
}

export function HoyEnCampo() {
  const { usuario, modulos } = usePanel();
  const tienePagina = (modulo: string, pagina: string) =>
    modulos.some((m) => m.ruta === modulo && m.paginas.some((p) => p.ruta === pagina));
  const verNovedades = tienePagina("gestion-campo", "novedades");
  const hoy = fechaEnZonaIso(new Date());

  const [revision, setRevision] = useState(0);
  const [terminada, setTerminada] = useState(-1);
  const [datos, setDatos] = useState<DatosHoy | null>(null);
  const [error, setError] = useState("");
  const [pila, setPila] = useState<HojaHoy[]>([]);
  const [filtro, setFiltro] = useState<FiltroEquipoHoy>("todos");
  const cargando = terminada !== revision;
  const hoja = pila.at(-1) ?? null;
  const abrir = (h: HojaHoy) => setPila((p) => [...p, h]);
  const actualizar = () => setRevision((n) => n + 1);

  useEffect(() => {
    const controller = new AbortController();
    const opciones = { signal: controller.signal };
    Promise.all([
      apiFetch<SupervisionResumenData>(
        `/campo/supervision/resumen?fecha=${fechaEnZonaIso(new Date())}`,
        opciones,
      ),
      verNovedades
        ? apiFetch<NovedadesResponse>(
            "/campo/novedades?estado=ABIERTA&page=1&limit=10",
            opciones,
          ).catch(() => null)
        : Promise.resolve(null),
    ])
      .then(([resumen, novedades]) => {
        if (controller.signal.aborted) return;
        setDatos({
          resumen,
          novedades: novedades?.items ?? [],
          abiertas: novedades ? novedades.counts.abierta : null,
          actualizado: new Date().toISOString(),
        });
        setError("");
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : "No se pudo cargar el tablero");
      })
      .finally(() => {
        if (!controller.signal.aborted) setTerminada(revision);
      });
    return () => controller.abort();
  }, [revision, verNovedades]);

  // Se actualiza solo cada 5 minutos mientras la pestaña está visible.
  useEffect(() => {
    const reloj = setInterval(() => {
      if (!document.hidden) setRevision((n) => n + 1);
    }, ACTUALIZAR_CADA_MS);
    return () => clearInterval(reloj);
  }, []);

  const resumen = datos?.resumen ?? null;
  const equipo = useMemo(
    () => ordenarEquipo(resumen?.colaboradores ?? []),
    [resumen],
  );
  const atender = useMemo(
    () => (resumen ? itemsAtenderAhora(resumen, datos?.novedades ?? []) : []),
    [resumen, datos?.novedades],
  );
  const visibles = filtrarEquipo(equipo, filtro);
  const personaHoja =
    hoja?.tipo === "persona" ? equipo.find((c) => c.id === hoja.id) ?? null : null;

  const tituloHoja = !hoja
    ? ""
    : hoja.tipo === "indicador"
      ? TITULO_INDICADOR[hoja.indicador]
      : hoja.tipo === "persona"
        ? (personaHoja?.nombre ?? "Colaborador")
        : "Novedad";

  return (
    <section aria-label="Hoy en campo" className="min-w-0 space-y-4 sm:space-y-5">
      <EncabezadoTablero
        rotulo={`${usuario.rol?.descripcion ?? "Supervisión"} · ${usuario.empresa.nombre}`}
        titulo="Hoy en campo"
        subtitulo={`${formatoDiaLargo(hoy)}${resumen ? ` · ${resumen.presentismo.totalEquipo} personas en tu equipo · ${resumen.rutas.total} visitas` : ""}`}
        cargando={cargando}
        actualizado={datos ? formatoHora(datos.actualizado) : null}
        onActualizar={actualizar}
      />

      {error ? (
        <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-100">
          {error}{" "}
          <button type="button" onClick={actualizar} className={`font-semibold underline ${enfoque}`}>
            Reintentar
          </button>
        </p>
      ) : null}

      {!resumen ? (
        cargando ? (
          <p role="status" className="py-8 text-center text-sm text-muted">
            Cargando el día de tu equipo…
          </p>
        ) : null
      ) : (
        <>
          <div>
            <p className="mb-2 flex items-baseline justify-between gap-2 px-0.5">
              <span className="text-[11px] font-bold uppercase tracking-wide text-muted">Indicadores del día</span>
              <span className="text-[11px] text-muted sm:text-xs">Tocá para ver el detalle</span>
            </p>
            <Indicadores
              resumen={resumen}
              novedades={datos?.novedades ?? []}
              abiertas={datos?.abiertas ?? null}
              onAbrir={(indicador) => abrir({ tipo: "indicador", indicador })}
            />
          </div>

          <div className="grid min-w-0 gap-4 lg:grid-cols-2 lg:items-start">
            <SeccionTablero
              titulo="Atender ahora"
              resumen={atender.length ? `${atender.length} pendientes` : "Todo en orden"}
              destacado={atender.some((a) => a.tono === "bad")}
            >
              <AtenderAhora items={atender} onAbrir={abrir} />
            </SeccionTablero>

            <SeccionTablero titulo="Equipo" resumen={`${visibles.length} · por prioridad`}>
              <div
                role="group"
                aria-label="Filtrar equipo"
                className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0"
              >
                {(
                  [
                    ["todos", "Todos", equipo.length],
                    ["atencion", "Requieren atención", equipo.filter(requiereAtencion).length],
                    ["alertas", "Con alertas", equipo.filter(conAlertas).length],
                  ] as const
                ).map(([clave, etiqueta, cantidad]) => (
                  <button
                    key={clave}
                    type="button"
                    aria-pressed={filtro === clave}
                    onClick={() => setFiltro(clave)}
                    className={`min-h-11 shrink-0 cursor-pointer whitespace-nowrap rounded-full border px-3 text-xs font-semibold transition-colors ${enfoque} ${
                      filtro === clave
                        ? "border-foreground bg-foreground text-background"
                        : "border-line bg-surface-raised text-muted hover:border-brand-500 hover:text-foreground"
                    }`}
                  >
                    {etiqueta}
                    <span className="ml-1 tabular-nums opacity-80">{cantidad}</span>
                  </button>
                ))}
              </div>
              <ListaEquipo equipo={visibles} onAbrir={(id) => abrir({ tipo: "persona", id })} />
            </SeccionTablero>
          </div>
        </>
      )}

      {hoja && resumen ? (
        <Modal
          titulo={tituloHoja}
          abierto
          hojaMovil
          ancho="lg"
          onCerrar={() => setPila([])}
        >
          <div className="min-w-0 space-y-3">
            {pila.length > 1 ? (
              <button
                type="button"
                onClick={() => setPila((p) => p.slice(0, -1))}
                className={`min-h-11 cursor-pointer whitespace-nowrap rounded-lg border border-line px-3 text-sm font-semibold text-foreground transition-colors hover:bg-surface-soft ${enfoque}`}
              >
                ← Volver
              </button>
            ) : null}
            {hoja.tipo === "indicador" ? (
              <DetalleIndicador
                indicador={hoja.indicador}
                resumen={resumen}
                equipo={equipo}
                novedades={datos?.novedades ?? []}
                abiertas={datos?.abiertas ?? null}
                onAbrir={abrir}
              />
            ) : hoja.tipo === "persona" ? (
              <HojaColaborador id={hoja.id} item={personaHoja} fecha={hoy} />
            ) : (
              <HiloNovedad id={hoja.id} onActualizado={actualizar} />
            )}
          </div>
        </Modal>
      ) : null}
    </section>
  );
}

function Indicadores({
  resumen,
  novedades,
  abiertas,
  onAbrir,
}: {
  resumen: SupervisionResumenData;
  novedades: NovedadCampoItem[];
  abiertas: number | null;
  onAbrir: (indicador: IndicadorHoy) => void;
}) {
  const e = resumen.presentismo.estados;
  const totalEquipo = resumen.presentismo.totalEquipo;
  const enCampo = e.PRESENTE + e.TARDE + e.INCOMPLETO;
  const r = resumen.rutas;
  const t = resumen.tareas;
  const reportadasHoy = resumen.colaboradores.reduce((s, c) => s + c.novedadesCount, 0);
  const criticas = novedades.filter((n) => n.prioridad === "CRITICA").length;

  const tarjetas: {
    clave: IndicadorHoy;
    letra: string;
    nombre: string;
    tono: TonoHoy;
    valor: ReactNode;
    barra: ReactNode;
    nota: ReactNode;
  }[] = [
    {
      clave: "presentismo",
      letra: "A",
      nombre: "Presentismo",
      tono: e.AUSENTE ? "bad" : e.TARDE || e.INCOMPLETO ? "warn" : "ok",
      valor: (
        <>
          {pct(enCampo, totalEquipo)}
          <small className="text-base font-semibold text-muted">%</small>
        </>
      ),
      barra: (
        <BarraSegmentos
          total={totalEquipo}
          segmentos={ORDEN_PRESENTISMO.map((estado) => ({
            valor: e[estado],
            clase: PRESENTISMO_UI[estado].barra,
            etiqueta: PRESENTISMO_UI[estado].etiqueta.toLowerCase(),
          }))}
        />
      ),
      nota: (
        <>
          <b className="text-foreground">{enCampo} de {totalEquipo}</b> en campo
          {e.TARDE ? <span className="font-semibold text-amber-700 dark:text-amber-300"> · {e.TARDE} tarde</span> : null}
          {e.AUSENTE ? <span className="font-semibold text-red-700 dark:text-red-300"> · {e.AUSENTE} ausente{e.AUSENTE > 1 ? "s" : ""}</span> : null}
        </>
      ),
    },
    {
      clave: "visitas",
      letra: "B",
      nombre: "Visitas",
      tono: r.ausentes ? "bad" : r.incompletas ? "warn" : "ok",
      valor: (
        <>
          {r.completadas}
          <small className="text-base font-semibold text-muted">/{r.total}</small>
        </>
      ),
      barra: (
        <BarraSegmentos
          total={r.total}
          segmentos={[
            { valor: r.completadas, clase: "bg-emerald-600 dark:bg-emerald-500", etiqueta: "hechas" },
            { valor: r.enCurso, clase: RAYADO_EN_CURSO, etiqueta: "en curso" },
            { valor: r.incompletas, clase: "bg-orange-500 dark:bg-orange-400", etiqueta: "sin salida" },
            { valor: r.ausentes, clase: "bg-red-600 dark:bg-red-500", etiqueta: "sin visitar" },
          ]}
        />
      ),
      nota: (
        <>
          <b className="text-foreground">{r.enCurso} en curso</b> · {r.pendientes} pendientes
          {r.ausentes ? <span className="font-semibold text-red-700 dark:text-red-300"> · {r.ausentes} sin visitar</span> : null}
        </>
      ),
    },
    {
      clave: "tareas",
      letra: "C",
      nombre: "Tareas",
      tono: t.obligatoriasPendientes ? "warn" : "ok",
      valor: (
        <>
          {t.pct}
          <small className="text-base font-semibold text-muted">%</small>
        </>
      ),
      barra: (
        <BarraSegmentos
          total={t.total}
          segmentos={[{ valor: t.completadas, clase: "bg-brand-600 dark:bg-brand-500", etiqueta: "hechas" }]}
        />
      ),
      nota: (
        <>
          <b className="text-foreground">{t.completadas} de {t.total}</b> hechas
          {t.obligatoriasPendientes ? (
            <span className="font-semibold text-amber-700 dark:text-amber-300"> · {t.obligatoriasPendientes} obligatorias pendientes</span>
          ) : null}
        </>
      ),
    },
    {
      clave: "novedades",
      letra: "D",
      nombre: "Novedades",
      tono: criticas ? "bad" : (abiertas ?? reportadasHoy) ? "warn" : "ok",
      valor: (
        <>
          {abiertas ?? reportadasHoy}
          <small className="text-base font-semibold text-muted">{abiertas !== null ? " abiertas" : " hoy"}</small>
        </>
      ),
      barra: (
        <BarraSegmentos
          total={Math.max(novedades.length, 1)}
          segmentos={(["CRITICA", "ALTA", "NORMAL"] as const).map((p) => ({
            valor: novedades.filter((n) => n.prioridad === p).length,
            clase: PRIORIDAD_UI[p].barra,
            etiqueta: PRIORIDAD_UI[p].etiqueta.toLowerCase(),
          }))}
        />
      ),
      nota: (
        <>
          {criticas ? <span className="font-semibold text-red-700 dark:text-red-300">{criticas} crítica{criticas > 1 ? "s" : ""} · </span> : null}
          {reportadasHoy} reportada{reportadasHoy === 1 ? "" : "s"} hoy
        </>
      ),
    },
  ];

  return (
    <div className="grid min-w-0 grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-3">
      {tarjetas.map((k) => (
        <TarjetaIndicador
          key={k.clave}
          letra={k.letra}
          nombre={k.nombre}
          tono={k.tono}
          valor={k.valor}
          barra={k.barra}
          nota={k.nota}
          onClick={() => onAbrir(k.clave)}
          etiqueta={`Ver detalle de ${k.nombre}`}
        />
      ))}
    </div>
  );
}

function IconoAtencion({ icono }: { icono: ItemAtencionHoy["icono"] }) {
  const clase = "h-4 w-4";
  if (icono === "persona") return <IconoContacto className={clase} />;
  if (icono === "alerta") return <IconoAlerta className={clase} />;
  if (icono === "reloj") return <IconoReloj className={clase} />;
  return <IconoTareas className={clase} />;
}

function AtenderAhora({
  items,
  onAbrir,
}: {
  items: ItemAtencionHoy[];
  onAbrir: (h: HojaHoy) => void;
}) {
  return (
    <ListaAtencion vacio={!items.length}>
      {items.map((it) => (
        <FilaAtencion
          key={it.clave}
          tono={it.tono}
          icono={<IconoAtencion icono={it.icono} />}
          titulo={it.titulo}
          detalle={it.detalle}
          accion={it.accion}
          onClick={() => onAbrir(it.abre)}
        />
      ))}
    </ListaAtencion>
  );
}

function Avatar({ c, grande = false }: { c: Pick<ColaboradorResumen, "iniciales" | "estadoPresentismo">; grande?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-full border-[3px] bg-surface-soft font-bold text-foreground ${PRESENTISMO_UI[c.estadoPresentismo].anillo} ${grande ? "h-12 w-12 text-base" : "h-10 w-10 text-sm"}`}
    >
      {c.iniciales}
    </span>
  );
}

function MiniBarra({ etiqueta, hechas, total, segmentos }: { etiqueta: string; hechas: number; total: number; segmentos: Parameters<typeof BarraSegmentos>[0]["segmentos"] }) {
  return (
    <span className="flex min-w-0 flex-col gap-1">
      <span className="flex justify-between gap-1 text-[11px] text-muted">
        {etiqueta}
        <b className="font-semibold tabular-nums text-foreground">
          {hechas}/{total}
        </b>
      </span>
      <BarraSegmentos total={total} segmentos={segmentos} alto="h-1.5" />
    </span>
  );
}

function ListaEquipo({
  equipo,
  onAbrir,
}: {
  equipo: ColaboradorResumen[];
  onAbrir: (id: number) => void;
}) {
  if (!equipo.length)
    return (
      <p className="rounded-xl border border-dashed border-line p-4 text-center text-sm text-muted">
        Nadie en este filtro.
      </p>
    );
  return (
    <ul
      aria-label="Equipo"
      className="overflow-hidden rounded-2xl border border-line bg-surface-raised shadow-[0_2px_8px_rgba(var(--warm-shadow),0.06)]"
    >
      {equipo.map((c) => (
        <li key={c.id} className="border-t border-line first:border-t-0 [content-visibility:auto]">
          <button
            type="button"
            onClick={() => onAbrir(c.id)}
            className={`grid w-full min-w-0 cursor-pointer grid-cols-[auto_minmax(0,1fr)] items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-surface-soft/60 ${enfoque} focus-visible:ring-inset`}
          >
            <Avatar c={c} />
            <span className="flex min-w-0 flex-col gap-1">
              <span className="flex min-w-0 items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold text-foreground">{c.nombre}</span>
                <span className="flex shrink-0 items-center gap-1">
                  {c.novedadesCount ? (
                    <span
                      className="inline-flex items-center gap-0.5 rounded-md bg-sky-100 px-1.5 text-[11px] font-bold text-sky-800 dark:bg-sky-950/60 dark:text-sky-300"
                      title={`${c.novedadesCount} novedades reportadas hoy`}
                    >
                      <IconoAlerta className="h-3 w-3" />
                      {c.novedadesCount}
                    </span>
                  ) : null}
                  <span className={`whitespace-nowrap rounded-md px-1.5 text-[11px] font-bold ${PRESENTISMO_UI[c.estadoPresentismo].pill}`}>
                    {PRESENTISMO_UI[c.estadoPresentismo].etiqueta}
                  </span>
                </span>
              </span>
              <span className="truncate text-[11px] text-muted sm:text-xs">
                {c.inicioJornada
                  ? `Entrada ${c.inicioJornada}${c.finJornada ? ` · Salida ${c.finJornada}` : ""}`
                  : "Sin entrada registrada"}
              </span>
              <span className="grid grid-cols-2 gap-3">
                <MiniBarra
                  etiqueta="Visitas"
                  hechas={c.ruta.completadas}
                  total={c.ruta.total}
                  segmentos={[
                    { valor: c.ruta.completadas, clase: "bg-emerald-600 dark:bg-emerald-500", etiqueta: "hechas" },
                    { valor: c.ruta.enCurso, clase: RAYADO_EN_CURSO, etiqueta: "en curso" },
                  ]}
                />
                <MiniBarra
                  etiqueta="Tareas"
                  hechas={c.tareas.completadas}
                  total={c.tareas.total}
                  segmentos={[{ valor: c.tareas.completadas, clase: "bg-brand-600 dark:bg-brand-500", etiqueta: "hechas" }]}
                />
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function Conteos({ items }: { items: { etiqueta: string; valor: number; clase?: string }[] }) {
  return (
    <div className={`grid gap-1.5 ${items.length > 4 ? "grid-cols-3 sm:grid-cols-5" : items.length === 4 ? "grid-cols-4" : "grid-cols-3"}`}>
      {items.map((i) => (
        <div key={i.etiqueta} className="min-w-0 rounded-lg bg-surface-soft px-2 py-1.5">
          <b className={`ft-display block text-xl leading-tight tabular-nums ${i.clase ?? "text-foreground"}`}>{i.valor}</b>
          <span className="block truncate text-[11px] text-muted">{i.etiqueta}</span>
        </div>
      ))}
    </div>
  );
}

function FilaPersona({
  c,
  onAbrir,
  derecha,
  children,
}: {
  c: ColaboradorResumen;
  onAbrir: () => void;
  derecha: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="border-t border-line py-2.5 first:border-t-0 first:pt-0 last:pb-0">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <button
          type="button"
          onClick={onAbrir}
          className={`min-h-11 min-w-0 cursor-pointer truncate rounded text-left text-sm font-semibold text-foreground hover:underline ${enfoque}`}
        >
          {c.nombre}
        </button>
        <span className="shrink-0">{derecha}</span>
      </div>
      {children}
    </div>
  );
}

function DetalleIndicador({
  indicador,
  resumen,
  equipo,
  novedades,
  abiertas,
  onAbrir,
}: {
  indicador: IndicadorHoy;
  resumen: SupervisionResumenData;
  equipo: ColaboradorResumen[];
  novedades: NovedadCampoItem[];
  abiertas: number | null;
  onAbrir: (h: HojaHoy) => void;
}) {
  const persona = (c: ColaboradorResumen) => () => onAbrir({ tipo: "persona", id: c.id });

  if (indicador === "presentismo") {
    const e = resumen.presentismo.estados;
    return (
      <>
        <div className={`${panel} space-y-2.5`}>
          <Conteos
            items={ORDEN_PRESENTISMO.map((estado) => ({
              etiqueta: PRESENTISMO_UI[estado].etiqueta,
              valor: e[estado],
              clase:
                estado === "PRESENTE"
                  ? "text-emerald-700 dark:text-emerald-300"
                  : estado === "TARDE"
                    ? "text-amber-700 dark:text-amber-300"
                    : estado === "AUSENTE"
                      ? "text-red-700 dark:text-red-300"
                      : estado === "INCOMPLETO"
                        ? "text-orange-700 dark:text-orange-300"
                        : undefined,
            }))}
          />
          <BarraSegmentos
            total={resumen.presentismo.totalEquipo}
            segmentos={ORDEN_PRESENTISMO.map((estado) => ({
              valor: e[estado],
              clase: PRESENTISMO_UI[estado].barra,
              etiqueta: PRESENTISMO_UI[estado].etiqueta.toLowerCase(),
            }))}
          />
          <p className="text-xs text-muted">
            Equipo de {resumen.presentismo.totalEquipo}. &quot;Sin entrada&quot; incluye a quien todavía no empezó su horario.
          </p>
        </div>
        <div className={panel}>
          <h3 className={tituloPanel}>Marcaciones</h3>
          {equipo.map((c) => (
            <FilaPersona
              key={c.id}
              c={c}
              onAbrir={persona(c)}
              derecha={
                <span className={`whitespace-nowrap rounded-md px-1.5 text-[11px] font-bold ${PRESENTISMO_UI[c.estadoPresentismo].pill}`}>
                  {PRESENTISMO_UI[c.estadoPresentismo].etiqueta}
                  {c.inicioJornada ? ` · ${c.inicioJornada}` : ""}
                </span>
              }
            >
              {c.estadoPresentismo === "AUSENTE" && telefonoValido(c.telefono) ? (
                <a
                  href={hrefTelefono(c.telefono)}
                  className={`mt-1.5 inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-brand-700 px-3 text-xs font-semibold text-white hover:bg-brand-800 dark:bg-brand-500 dark:text-brand-950 dark:hover:brightness-110 ${enfoque}`}
                >
                  <IconoTelefono className="h-3.5 w-3.5" />
                  Llamar a {primerNombre(c.nombre)}
                </a>
              ) : null}
            </FilaPersona>
          ))}
        </div>
      </>
    );
  }

  if (indicador === "visitas") {
    const r = resumen.rutas;
    return (
      <>
        <div className={`${panel} space-y-2.5`}>
          <Conteos
            items={[
              { etiqueta: "Hechas", valor: r.completadas, clase: "text-emerald-700 dark:text-emerald-300" },
              { etiqueta: "En curso", valor: r.enCurso, clase: "text-sky-700 dark:text-sky-300" },
              { etiqueta: "Pendientes", valor: r.pendientes },
              { etiqueta: "Sin visitar", valor: r.ausentes + r.incompletas, clase: "text-red-700 dark:text-red-300" },
            ]}
          />
          <p className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
            <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-emerald-600 dark:bg-emerald-500" />Hecha</span>
            <span className="inline-flex items-center gap-1"><i className={`h-2.5 w-2.5 rounded-sm ${RAYADO_EN_CURSO}`} />En curso</span>
            <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-orange-500 dark:bg-orange-400" />Sin salida</span>
            <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-red-600 dark:bg-red-500" />Sin visitar</span>
          </p>
        </div>
        <div className={panel}>
          <h3 className={tituloPanel}>Avance por repositor</h3>
          {equipo.map((c) => (
            <FilaPersona
              key={c.id}
              c={c}
              onAbrir={persona(c)}
              derecha={<span className="text-xs tabular-nums text-muted"><b className="text-foreground">{c.ruta.completadas}</b>/{c.ruta.total}</span>}
            >
              <span className="mt-1 block">
                <BarraSegmentos
                  total={c.ruta.total}
                  alto="h-1.5"
                  segmentos={[
                    { valor: c.ruta.completadas, clase: "bg-emerald-600 dark:bg-emerald-500", etiqueta: "hechas" },
                    { valor: c.ruta.enCurso, clase: RAYADO_EN_CURSO, etiqueta: "en curso" },
                    { valor: c.ruta.incompletas, clase: "bg-orange-500 dark:bg-orange-400", etiqueta: "sin salida" },
                    { valor: c.ruta.ausentes, clase: "bg-red-600 dark:bg-red-500", etiqueta: "sin visitar" },
                  ]}
                />
              </span>
            </FilaPersona>
          ))}
        </div>
      </>
    );
  }

  if (indicador === "tareas") {
    const t = resumen.tareas;
    const porObligatorias = [...equipo].sort(
      (a, b) => b.tareas.obligPendientes - a.tareas.obligPendientes || a.tareas.pct - b.tareas.pct,
    );
    return (
      <>
        <div className={panel}>
          <Conteos
            items={[
              { etiqueta: "Hechas", valor: t.completadas, clase: "text-brand-700 dark:text-brand-200" },
              { etiqueta: "Pendientes", valor: Math.max(0, t.total - t.completadas) },
              { etiqueta: "Obligatorias", valor: t.obligatoriasPendientes, clase: "text-red-700 dark:text-red-300" },
            ]}
          />
        </div>
        <div className={panel}>
          <h3 className={tituloPanel}>Por repositor</h3>
          {porObligatorias.map((c) => (
            <FilaPersona
              key={c.id}
              c={c}
              onAbrir={persona(c)}
              derecha={
                <span className="text-xs tabular-nums text-muted">
                  <b className="text-foreground">{c.tareas.completadas}</b>/{c.tareas.total} · {c.tareas.pct}%
                </span>
              }
            >
              <span className="mt-1 block">
                <BarraSegmentos
                  total={c.tareas.total}
                  alto="h-1.5"
                  segmentos={[
                    {
                      valor: c.tareas.completadas,
                      clase: c.tareas.pct < 50 ? "bg-amber-500 dark:bg-amber-400" : "bg-brand-600 dark:bg-brand-500",
                      etiqueta: "hechas",
                    },
                  ]}
                />
              </span>
              {c.tareas.obligPendientes ? (
                <span className="mt-1 block text-[11px] font-semibold text-red-700 dark:text-red-300">
                  {c.tareas.obligPendientes} obligatoria{c.tareas.obligPendientes > 1 ? "s" : ""} pendiente{c.tareas.obligPendientes > 1 ? "s" : ""}
                </span>
              ) : null}
            </FilaPersona>
          ))}
        </div>
      </>
    );
  }

  // Novedades
  if (abiertas === null)
    return (
      <p className={`${panel} text-sm text-muted`}>
        Tu rol no tiene acceso a la página de novedades. Hoy el equipo reportó{" "}
        {resumen.colaboradores.reduce((s, c) => s + c.novedadesCount, 0)}.
      </p>
    );
  return (
    <>
      <p className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
        {(["CRITICA", "ALTA", "NORMAL"] as const).map((p) => (
          <span key={p} className="inline-flex items-center gap-1">
            <i className={`h-2 w-2 rounded-full ${PRIORIDAD_UI[p].punto}`} />
            {PRIORIDAD_UI[p].etiqueta}
          </span>
        ))}
      </p>
      <div className={panel}>
        {novedades.length ? (
          novedades.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => onAbrir({ tipo: "novedad", id: n.id })}
              className={`block w-full min-w-0 cursor-pointer border-t border-line py-2.5 text-left first:border-t-0 first:pt-0 last:pb-0 hover:bg-surface-soft/40 ${enfoque}`}
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <i className={`h-2 w-2 shrink-0 rounded-full ${PRIORIDAD_UI[n.prioridad].punto}`} />
                <span className="truncate text-sm font-semibold text-foreground">{n.titulo}</span>
              </span>
              <span className="mt-0.5 block truncate text-[11px] text-muted">
                {n.tipo.charAt(0) + n.tipo.slice(1).toLowerCase()} · {n.local.nombre} · {primerNombre(`${n.usuario.nombre}`)} {horaOFechaCorta(n.creadoAt)}
              </span>
            </button>
          ))
        ) : (
          <p className="text-sm text-muted">No hay novedades abiertas.</p>
        )}
      </div>
      <Link
        href="/panel/gestion-campo/novedades"
        className={`flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-line bg-surface-raised px-3 text-sm font-semibold text-foreground transition-colors hover:border-brand-500 hover:bg-surface-soft ${enfoque}`}
      >
        Ver todas las novedades ({abiertas}) <span aria-hidden="true">→</span>
      </Link>
    </>
  );
}

function HojaColaborador({
  id,
  item,
  fecha,
}: {
  id: number;
  item: ColaboradorResumen | null;
  fecha: string;
}) {
  const [detalle, setDetalle] = useState<ColaboradorDetalleData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    apiFetch<ColaboradorDetalleData>(
      `/campo/supervision/colaboradores/${id}?fecha=${fecha}`,
      { signal: controller.signal },
    )
      .then((d) => {
        if (!controller.signal.aborted) setDetalle(d);
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : "No se pudo cargar el detalle");
      });
    return () => controller.abort();
  }, [id, fecha]);

  const telefono = detalle?.colaborador.telefono ?? item?.telefono ?? "";

  return (
    <>
      {item ? (
        <div className="flex items-center gap-3">
          <Avatar c={item} grande />
          <div className="min-w-0">
            <p className="truncate text-xs text-muted">{item.zona}</p>
            <span className={`mt-0.5 inline-block rounded-md px-1.5 text-[11px] font-bold ${PRESENTISMO_UI[item.estadoPresentismo].pill}`}>
              {PRESENTISMO_UI[item.estadoPresentismo].etiqueta}
              {item.inicioJornada ? ` · ${item.inicioJornada}` : ""}
            </span>
          </div>
        </div>
      ) : null}

      {item ? (
        <div className="grid grid-cols-2 gap-2">
          {[
            ["Visitas", `${item.ruta.completadas} de ${item.ruta.total}`],
            ["Tareas", `${item.tareas.completadas} de ${item.tareas.total}`],
            ["Obligatorias pend.", String(item.tareas.obligPendientes)],
            ["Novedades hoy", String(item.novedadesCount)],
          ].map(([k, v]) => (
            <div key={k} className="min-w-0 rounded-xl border border-line bg-surface-raised px-3 py-2">
              <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted">{k}</p>
              <p
                className={`text-sm font-semibold tabular-nums ${k === "Obligatorias pend." && item.tareas.obligPendientes ? "text-red-700 dark:text-red-300" : "text-foreground"}`}
              >
                {v}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>
      ) : !detalle ? (
        <p role="status" className="py-4 text-center text-sm text-muted">Cargando agenda…</p>
      ) : (
        <>
          <div className={panel}>
            <h3 className={tituloPanel}>Agenda del día</h3>
            {detalle.ruta.length ? (
              detalle.ruta.map((p) => (
                <div key={p.id} className="flex min-w-0 items-center justify-between gap-2 border-t border-line py-2 first:border-t-0 first:pt-0 last:pb-0">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-foreground">{p.local}</span>
                    <span className="block truncate text-[11px] text-muted">
                      {[p.cliente, p.ventana, p.checkin ? `Entrada ${p.checkin}` : null, p.checkout ? `Salida ${p.checkout}` : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <span className={`shrink-0 whitespace-nowrap rounded-md px-1.5 text-[11px] font-bold ${RUTA_PILL[p.estado]}`}>
                    {RUTA[p.estado].etiqueta}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted">Sin locales en la agenda de hoy.</p>
            )}
          </div>
          {detalle.novedades.length ? (
            <div className={panel}>
              <h3 className={tituloPanel}>Novedades que reportó</h3>
              {detalle.novedades.map((n) => (
                <div key={n.id} className="border-t border-line py-2 first:border-t-0 first:pt-0 last:pb-0">
                  <p className="text-sm font-semibold text-foreground">{n.texto}</p>
                  <p className="text-[11px] text-muted">{[n.tipo, n.cliente, n.hora].filter(Boolean).join(" · ")}</p>
                </div>
              ))}
            </div>
          ) : null}
        </>
      )}

      <div className="grid grid-cols-2 gap-2">
        {telefonoValido(telefono) ? (
          <a
            href={hrefTelefono(telefono)}
            className={`flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-brand-700 px-3 text-sm font-semibold text-white hover:bg-brand-800 dark:bg-brand-500 dark:text-brand-950 dark:hover:brightness-110 ${enfoque}`}
          >
            <IconoTelefono className="h-4 w-4" />
            Llamar
          </a>
        ) : null}
        <Link
          href="/panel/gestion-campo/visitas"
          className={`flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-line bg-surface-raised px-3 text-sm font-semibold text-foreground hover:border-brand-500 hover:bg-surface-soft ${enfoque} ${telefonoValido(telefono) ? "" : "col-span-2"}`}
        >
          Ver en Presentismo
        </Link>
      </div>
    </>
  );
}
