"use client";
import type { PeriodoFiltro } from "@/types/periodo-filtro";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { apiFetch } from "@/lib/api";
import { guardarCacheSesion, leerCacheSesion } from "@/lib/cache-sesion";
import { usePanel } from "@/components/panel/contexto";
import { Modal } from "@/components/modal";
import { HiloNovedad } from "./hilo-novedad";
import { DetallePresentismoInicio } from "./detalle-presentismo-inicio";
import { BarraSegmentos, RAYADO_EN_CURSO } from "./ui/barra-segmentos";
import {
  BotonActualizarTablero,
  ConteosFiltro,
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
import { fechaEnZonaIso, formatoHora, horaOFechaCorta, textoRangoFechas } from "@/utils/fechas";
import {
  consultaPeriodoInicio,
  periodoInicioHoy,
  cuandoPeriodoInicio,
  rangoPeriodoInicio,
} from "@/utils/periodo-inicio";
import { SelectorPeriodoInicio } from "./ui/periodo-inicio";
import { SaludoRuta } from "./ui/saludo-ruta";
import {
  FILTROS_RUTA,
  FILTROS_TAREAS,
  conAlertas,
  filtrarEquipo,
  filtrarPorConteo,
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
  visitas: "Itinerario",
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
  const [periodo, setPeriodo] = useState<PeriodoFiltro>(() => periodoInicioHoy(hoy));
  const consulta = consultaPeriodoInicio(periodo, hoy);
  const rango = rangoPeriodoInicio(periodo, hoy);
  const cuando = cuandoPeriodoInicio(periodo);

  const [revision, setRevision] = useState(0);
  const [terminada, setTerminada] = useState("");
  const claveCarga = `${revision}|${consulta}`;
  const claveCache = `hoy|${usuario.id}|${consulta}`;
  // Lo último que se vio de este período en esta pestaña aparece enseguida.
  const [datos, setDatos] = useState<DatosHoy | null>(
    () => leerCacheSesion<DatosHoy>(claveCache)?.valor ?? null,
  );
  const cambiarPeriodo = (nuevo: PeriodoFiltro) => {
    if (nuevo === periodo) return;
    setPeriodo(nuevo);
    // No mezclar los números de otro período mientras llegan los nuevos.
    setDatos(
      leerCacheSesion<DatosHoy>(
        `hoy|${usuario.id}|${consultaPeriodoInicio(nuevo, hoy)}`,
      )?.valor ?? null,
    );
  };
  const [error, setError] = useState("");
  const [pila, setPila] = useState<HojaHoy[]>([]);
  const [filtro, setFiltro] = useState<FiltroEquipoHoy>("todos");
  const cargando = terminada !== claveCarga;
  const hoja = pila.at(-1) ?? null;
  const abrir = (h: HojaHoy) => setPila((p) => [...p, h]);
  const actualizar = () => setRevision((n) => n + 1);

  useEffect(() => {
    const controller = new AbortController();
    const opciones = { signal: controller.signal };
    const pedidoResumen = apiFetch<SupervisionResumenData>(
      `/campo/supervision/resumen?${consulta}`,
      opciones,
    );
    const pedidoNovedades = verNovedades
      ? apiFetch<NovedadesResponse>(
          "/campo/novedades?estado=ABIERTA&page=1&limit=10",
          opciones,
        ).catch(() => null)
      : Promise.resolve(null);
    // El resumen se muestra apenas llega, sin esperar las novedades.
    pedidoResumen
      .then((resumen) => {
        if (controller.signal.aborted) return;
        setDatos((previo) => ({
          resumen,
          novedades: previo?.novedades ?? [],
          abiertas: previo?.abiertas ?? null,
          actualizado: new Date().toISOString(),
        }));
      })
      .catch(() => undefined);
    Promise.all([pedidoResumen, pedidoNovedades])
      .then(([resumen, novedades]) => {
        if (controller.signal.aborted) return;
        const nuevos: DatosHoy = {
          resumen,
          novedades: novedades?.items ?? [],
          abiertas: novedades ? novedades.counts.abierta : null,
          actualizado: new Date().toISOString(),
        };
        setDatos(nuevos);
        guardarCacheSesion(claveCache, nuevos);
        setError("");
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : "No se pudo cargar el tablero");
      })
      .finally(() => {
        if (!controller.signal.aborted) setTerminada(claveCarga);
      });
    return () => controller.abort();
  }, [revision, verNovedades, claveCache, consulta, claveCarga]);

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
    <section aria-label="Inicio del equipo" className="min-w-0 space-y-4 sm:space-y-5">
      <SaludoRuta
        nombre={primerNombre(usuario.nombre)}
        fechaTexto={textoRangoFechas(rango.desde, rango.hasta)}
        resumen={
          resumen
            ? `${resumen.presentismo.totalEquipo} personas en tu equipo · ${resumen.rutas.total} visitas`
            : "Cargando los datos de tu equipo…"
        }
      >
        <SelectorPeriodoInicio valor={periodo} onCambiar={cambiarPeriodo} />
      </SaludoRuta>

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
            Cargando los datos de tu equipo…
          </p>
        ) : null
      ) : (
        <>
          <div>
            <div className="mb-1 flex min-w-0 items-center justify-between gap-2 px-0.5">
              <span className="min-w-0 truncate text-[11px] font-bold uppercase tracking-wide text-muted">
                {periodo.clave === "hoy" ? "Indicadores del día" : `Indicadores · ${cuando}`}
                <span className="hidden font-normal normal-case tracking-normal sm:inline"> · tocá para ver el detalle</span>
              </span>
              <BotonActualizarTablero
                cargando={cargando}
                actualizado={datos ? formatoHora(datos.actualizado) : null}
                onActualizar={actualizar}
              />
            </div>
            <Indicadores
              resumen={resumen}
              novedades={datos?.novedades ?? []}
              abiertas={datos?.abiertas ?? null}
              cuando={cuando}
              onAbrir={(indicador) => abrir({ tipo: "indicador", indicador })}
            />
          </div>

          <div className="grid min-w-0 gap-4 lg:grid-cols-2 lg:items-start">
            <SeccionTablero
              titulo={periodo.clave === "hoy" ? "Atender ahora" : "Para revisar"}
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
              <ListaEquipo
                equipo={visibles}
                cuando={cuando}
                onAbrir={(id) => abrir({ tipo: "persona", id })}
              />
            </SeccionTablero>
          </div>
        </>
      )}

      {hoja && resumen ? (
        <Modal textoCerrar="Cerrar"
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
                key={hoja.indicador}
                indicador={hoja.indicador}
                unDia={rango.desde === rango.hasta}
                resumen={resumen}
                equipo={equipo}
                novedades={datos?.novedades ?? []}
                abiertas={datos?.abiertas ?? null}
                onAbrir={abrir}
              />
            ) : hoja.tipo === "persona" ? (
              <HojaColaborador
                id={hoja.id}
                item={personaHoja}
                consulta={consulta}
                cuando={cuando}
              />
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
  cuando,
  onAbrir,
}: {
  resumen: SupervisionResumenData;
  novedades: NovedadCampoItem[];
  abiertas: number | null;
  /** "hoy", "ayer", "esta semana"… */
  cuando: string;
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
      nombre: "Itinerario",
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
          <small className="text-base font-semibold text-muted">{abiertas !== null ? " abiertas" : ` ${cuando}`}</small>
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
          {reportadasHoy} reportada{reportadasHoy === 1 ? "" : "s"} {cuando}
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
          disabled={k.clave === "tareas" && t.total === 0}
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
  cuando,
  onAbrir,
}: {
  equipo: ColaboradorResumen[];
  cuando: string;
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
                      title={`${c.novedadesCount} novedades reportadas ${cuando}`}
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

const tituloLista = "text-[11px] font-bold uppercase tracking-wide text-muted";

/** Título de la lista de un detalle: dice qué KPI la está filtrando. */
function TituloLista({
  titulo,
  filtro,
  cantidad,
  onLimpiar,
}: {
  titulo: string;
  filtro?: string;
  cantidad: number;
  onLimpiar: () => void;
}) {
  return (
    <div className="mb-1 flex min-h-11 min-w-0 items-center justify-between gap-2">
      <h3 className={`min-w-0 truncate ${tituloLista}`}>
        {titulo}
        {filtro ? ` · ${filtro}` : ""}{" "}
        <span className="font-normal tabular-nums">({cantidad})</span>
      </h3>
      {filtro ? (
        <button
          type="button"
          onClick={onLimpiar}
          className={`min-h-11 shrink-0 cursor-pointer whitespace-nowrap rounded px-2 text-xs font-semibold text-accent-ink hover:bg-surface-soft ${enfoque}`}
        >
          Ver todos
        </button>
      ) : null}
    </div>
  );
}

const sinResultados = (
  <p className="py-4 text-center text-sm text-muted">Nadie en este estado.</p>
);

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
  unDia = false,
}: {
  indicador: IndicadorHoy;
  /** Período de un solo día (hoy, ayer o una fecha): muestra inicio, final y duración de la jornada. */
  unDia?: boolean;
  resumen: SupervisionResumenData;
  equipo: ColaboradorResumen[];
  novedades: NovedadCampoItem[];
  abiertas: number | null;
  onAbrir: (h: HojaHoy) => void;
}) {
  // El KPI tocado filtra la lista de abajo; tocarlo otra vez muestra todo.
  const [filtro, setFiltro] = useState<string | null>(null);
  const persona = (c: ColaboradorResumen) => () => onAbrir({ tipo: "persona", id: c.id });
  const etiquetaDe = (items: { clave: string; etiqueta: string }[]) =>
    items.find((i) => i.clave === filtro)?.etiqueta;
  const limpiar = () => setFiltro(null);

  if (indicador === "presentismo") {
    return <DetallePresentismoInicio resumen={resumen} equipo={equipo} unDia={unDia} onAbrir={(id) => onAbrir({ tipo: "persona", id })} />;
  }

  if (indicador === "visitas") {
    const r = resumen.rutas;
    const conteos = [
      { clave: "hechas", etiqueta: "Hechas", valor: r.completadas, clase: "text-emerald-700 dark:text-emerald-300" },
      { clave: "en_curso", etiqueta: "En curso", valor: r.enCurso, clase: "text-sky-700 dark:text-sky-300" },
      { clave: "pendientes", etiqueta: "Pendientes", valor: r.pendientes },
      { clave: "sin_visitar", etiqueta: "Sin visitar", valor: r.ausentes + r.incompletas, clase: "text-red-700 dark:text-red-300" },
    ].map((k) => ({ ...k, detalle: `${pct(k.valor, r.total)}%` }));
    const visibles = filtrarPorConteo(equipo, FILTROS_RUTA, filtro);
    return (
      <>
        <div className={`${panel} space-y-2.5`}>
          <ConteosFiltro etiqueta="Filtrar avance por estado de la ruta" items={conteos} activo={filtro} onFiltro={setFiltro} />
          <p className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
            <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-emerald-600 dark:bg-emerald-500" />Hecha</span>
            <span className="inline-flex items-center gap-1"><i className={`h-2.5 w-2.5 rounded-sm ${RAYADO_EN_CURSO}`} />En curso</span>
            <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-orange-500 dark:bg-orange-400" />Sin salida</span>
            <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-red-600 dark:bg-red-500" />Sin visitar</span>
          </p>
        </div>
        <div className={panel}>
          <TituloLista titulo="Avance por persona" filtro={etiquetaDe(conteos)} cantidad={visibles.length} onLimpiar={limpiar} />
          {visibles.length
            ? visibles.map((c) => (
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
              ))
            : sinResultados}
        </div>
      </>
    );
  }

  if (indicador === "tareas") {
    const t = resumen.tareas;
    const porObligatorias = [...equipo].sort(
      (a, b) => b.tareas.obligPendientes - a.tareas.obligPendientes || a.tareas.pct - b.tareas.pct,
    );
    const conteos = [
      { clave: "hechas", etiqueta: "Hechas", valor: t.completadas, clase: "text-brand-700 dark:text-brand-200" },
      { clave: "pendientes", etiqueta: "Pendientes", valor: Math.max(0, t.total - t.completadas) },
      { clave: "obligatorias", etiqueta: "Obligatorias", valor: t.obligatoriasPendientes, clase: "text-red-700 dark:text-red-300" },
    ].map((k) => ({ ...k, detalle: `${pct(k.valor, t.total)}%` }));
    const visibles = filtrarPorConteo(porObligatorias, FILTROS_TAREAS, filtro);
    return (
      <>
        <div className={panel}>
          <ConteosFiltro etiqueta="Filtrar tareas por estado" items={conteos} activo={filtro} onFiltro={setFiltro} />
        </div>
        <div className={panel}>
          <TituloLista titulo="Por persona" filtro={etiquetaDe(conteos)} cantidad={visibles.length} onLimpiar={limpiar} />
          {visibles.length
            ? visibles.map((c) => (
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
              ))
            : sinResultados}
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
  const conteos = (["CRITICA", "ALTA", "NORMAL"] as const).map((p) => ({
    clave: p,
    etiqueta: PRIORIDAD_UI[p].etiqueta,
    valor: novedades.filter((n) => n.prioridad === p).length,
    detalle: `${pct(novedades.filter((n) => n.prioridad === p).length, novedades.length)}%`,
    punto: PRIORIDAD_UI[p].punto,
  }));
  const visibles = filtro ? novedades.filter((n) => n.prioridad === filtro) : novedades;
  return (
    <>
      <ConteosFiltro etiqueta="Filtrar novedades por prioridad" items={conteos} activo={filtro} onFiltro={setFiltro} />
      <div className={panel}>
        <TituloLista titulo="Novedades abiertas" filtro={etiquetaDe(conteos)} cantidad={visibles.length} onLimpiar={limpiar} />
        {visibles.length ? (
          visibles.map((n) => (
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
          <p className="text-sm text-muted">
            {filtro ? "No hay novedades abiertas con esta prioridad." : "No hay novedades abiertas."}
          </p>
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
  consulta,
  cuando,
}: {
  id: number;
  item: ColaboradorResumen | null;
  /** Parámetros de fecha del período ("fecha=…" o "fechaInicio=…&fechaFin=…"). */
  consulta: string;
  cuando: string;
}) {
  const [detalle, setDetalle] = useState<ColaboradorDetalleData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    apiFetch<ColaboradorDetalleData>(
      `/campo/supervision/colaboradores/${id}?${consulta}`,
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
  }, [id, consulta]);

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
            [`Novedades ${cuando}`, String(item.novedadesCount)],
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
              detalle.ruta.map((p) => {
                // Llegó tarde a este local: la fila se pinta para verlo de un vistazo.
                const tarde = p.estadoPresentismo === "TARDE";
                return (
                <div
                  key={p.id}
                  className={`flex min-w-0 items-center justify-between gap-2 ${
                    tarde
                      ? "-mx-2 my-1 rounded-lg border border-amber-300 bg-amber-50 px-2 py-2 dark:border-amber-800 dark:bg-amber-950/50"
                      : "border-t border-line py-2 first:border-t-0 first:pt-0 last:pb-0"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-foreground">{p.local}</span>
                    <span className="block truncate text-[11px] text-muted">
                      {[p.localId, p.ventana, p.checkin ? `Entrada ${p.checkin}` : null, p.checkout ? `Salida ${p.checkout}` : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    {tarde ? (
                      <span className="mt-0.5 block text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                        Llegó tarde
                      </span>
                    ) : null}
                  </span>
                  <span className={`shrink-0 whitespace-nowrap rounded-md px-1.5 text-[11px] font-bold ${RUTA_PILL[p.estado]}`}>
                    {RUTA[p.estado].etiqueta}
                  </span>
                </div>
                );
              })
            ) : (
              <p className="text-sm text-muted">Sin locales en la agenda de {cuando}.</p>
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
