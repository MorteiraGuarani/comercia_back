"use client";

import { useEffect, useMemo, useState } from "react";
import { usePanel } from "@/components/panel/contexto";
import { apiFetch } from "@/lib/api";
import { guardarCacheSesion, leerCacheSesion } from "@/lib/cache-sesion";
import type { SupervisionResumenData } from "@/types/campo";
import type { PeriodoFiltro } from "@/types/periodo-filtro";
import {
  arbolDesempeno,
  personasRama,
  responsablesCascada,
  resumenRama,
} from "@/utils/desempeno-jefatura";
import { mensajeError } from "@/utils/error";
import { fechaEnZonaIso, formatoHora } from "@/utils/fechas";
import { conAlertas, pct } from "@/utils/hoy-en-campo";
import {
  consultaPeriodoInicio,
  cuandoPeriodoInicio,
  periodoInicioHoy,
} from "@/utils/periodo-inicio";
import { FiltrosJefatura, GruposCascada } from "./cascada-jefatura";
import { BarraSegmentos, RAYADO_EN_CURSO } from "./ui/barra-segmentos";
import { SelectorPeriodoInicio } from "./ui/periodo-inicio";
import {
  BotonActualizarTablero,
  ORDEN_PRESENTISMO,
  PRESENTISMO_UI,
  TarjetaIndicador,
  enfoqueTablero,
} from "./ui/tablero-campo";

// Inicio del jefe (módulo Jefatura): los números de todo su organigrama o de
// un supervisor, con los mismos datos que Jefatura · Desempeño.

interface DatosInicio {
  resumen: SupervisionResumenData;
  actualizado: string;
}

export function InicioJefatura() {
  const { usuario, modulos } = usePanel();
  const hoy = fechaEnZonaIso(new Date());
  const [periodo, setPeriodo] = useState<PeriodoFiltro>(() => periodoInicioHoy(hoy));
  const consulta = consultaPeriodoInicio(periodo, hoy);
  const cuando = cuandoPeriodoInicio(periodo);
  const cache = (q: string) =>
    leerCacheSesion<DatosInicio>(`inicio-jefatura|${usuario.id}|${q}`)?.valor ?? null;
  // Lo último que se vio de este período aparece enseguida.
  const [datos, setDatos] = useState<DatosInicio | null>(() => cache(consulta));
  const [revision, setRevision] = useState(0);
  const [terminada, setTerminada] = useState({ clave: "", error: "" });
  const claveCarga = `${revision}|${consulta}`;
  const cargando = terminada.clave !== claveCarga;
  const error = terminada.clave === claveCarga ? terminada.error : "";
  // 0: todo el organigrama junto; si no, el responsable elegido (cualquier nivel).
  const [responsableId, setResponsableId] = useState(0);
  // Las tarjetas llevan al detalle: Jefatura · Desempeño.
  const paginaDetalle = modulos
    .find((m) => m.ruta === "jefatura")
    ?.paginas.find((p) => p.ruta === "desempeno");

  useEffect(() => {
    const control = new AbortController();
    apiFetch<SupervisionResumenData>(`/campo/jefatura/resumen?${consulta}`, {
      signal: control.signal,
    })
      .then((resumen) => {
        const nuevos = { resumen, actualizado: new Date().toISOString() };
        guardarCacheSesion(`inicio-jefatura|${usuario.id}|${consulta}`, nuevos);
        setDatos(nuevos);
        setTerminada({ clave: claveCarga, error: "" });
      })
      .catch((e: unknown) => {
        if (control.signal.aborted) return;
        setTerminada({
          clave: claveCarga,
          error: mensajeError(e, "No se pudieron cargar los indicadores."),
        });
      });
    return () => control.abort();
  }, [claveCarga, consulta, usuario.id]);

  const resumen = datos?.resumen ?? null;
  const arbol = useMemo(
    () => (resumen ? arbolDesempeno(resumen.colaboradores, resumen.estructura) : []),
    [resumen],
  );
  const elegido = responsablesCascada(arbol).find(
    (r) => r.nodo.persona.id === responsableId,
  )?.nodo;
  const vista = resumen && elegido ? resumenRama(resumen.fecha, elegido) : resumen;
  // Equipos del nivel elegido: quienes tienen gente a cargo justo debajo.
  const subgrupos = (elegido ? elegido.hijos : arbol).filter((n) => n.hijos.length);
  const equipos = elegido && !subgrupos.length ? [elegido] : subgrupos;
  const activos = equipos.filter((n) =>
    personasRama(n).some((c) => c.inicioJornada !== null),
  ).length;

  const href = paginaDetalle ? `/panel/jefatura/${paginaDetalle.ruta}` : undefined;
  const tarjetas = vista
    ? (() => {
        const e = vista.presentismo.estados;
        const total = vista.presentismo.totalEquipo;
        const enCampo = e.PRESENTE + e.EN_CURSO + e.INCOMPLETO;
        const r = vista.rutas;
        const alertas = vista.colaboradores.filter(conAlertas).length;
        return [
          {
            letra: "A",
            nombre: "Presentismo",
            tono: e.AUSENTE ? "bad" : e.INCOMPLETO ? "warn" : "ok",
            valor: pct(enCampo, total),
            sufijo: "%",
            barra: (
              <BarraSegmentos
                total={total}
                segmentos={ORDEN_PRESENTISMO.map((estado) => ({
                  valor: e[estado],
                  clase: PRESENTISMO_UI[estado].barra,
                  etiqueta: PRESENTISMO_UI[estado].etiqueta.toLowerCase(),
                }))}
              />
            ),
            nota: `${enCampo} de ${total} colaboradores`,
          },
          {
            letra: "B",
            nombre: "Visitas realizadas",
            tono: r.ausentes ? "bad" : r.incompletas ? "warn" : "ok",
            valor: pct(r.completadas, r.total),
            sufijo: "%",
            barra: (
              <BarraSegmentos
                total={r.total}
                segmentos={[
                  { valor: r.completadas, clase: "bg-emerald-600 dark:bg-emerald-500", etiqueta: "visitados" },
                  { valor: r.enCurso, clase: RAYADO_EN_CURSO, etiqueta: "en curso" },
                  { valor: r.incompletas, clase: "bg-orange-500 dark:bg-orange-400", etiqueta: "sin salida" },
                  { valor: r.ausentes, clase: "bg-red-600 dark:bg-red-500", etiqueta: "sin visitar" },
                ]}
              />
            ),
            nota: `${r.completadas} de ${r.total} visitas`,
          },
          {
            letra: "C",
            nombre: "Equipos activos",
            tono: activos === equipos.length ? "ok" : activos ? "warn" : "bad",
            valor: activos,
            sufijo: "",
            barra: (
              <BarraSegmentos
                total={equipos.length}
                segmentos={[{ valor: activos, clase: "bg-brand-600 dark:bg-brand-500", etiqueta: "activos" }]}
              />
            ),
            nota: equipos.length
              ? `de ${equipos.length} ${equipos.length === 1 ? "equipo" : "equipos"} a cargo`
              : "Sin equipos a cargo",
          },
          {
            letra: "D",
            nombre: "Alertas pendientes",
            tono: alertas ? "bad" : "ok",
            valor: alertas,
            sufijo: "",
            barra: (
              <BarraSegmentos
                total={total}
                segmentos={[{ valor: alertas, clase: "bg-red-600 dark:bg-red-500", etiqueta: "con alertas" }]}
              />
            ),
            nota: alertas ? "Requieren atención" : "Sin alertas",
          },
        ] as const;
      })()
    : [];

  return (
    <section aria-label="Inicio de jefatura" className="min-w-0 space-y-5">
      <header className="min-w-0 space-y-4">
        <div className="min-w-0">
          <p className="truncate text-xs font-bold uppercase tracking-[0.14em] text-brand-700 dark:text-brand-200">
            {usuario.rol?.descripcion ?? "Jefatura"}
          </p>
          <h1 className="ft-display mt-2 text-3xl font-bold text-foreground sm:text-4xl">
            Inicio
          </h1>
          <p className="mt-1 text-sm text-muted sm:text-base">
            Visión consolidada de tus supervisores y equipos
          </p>
        </div>
        <FiltrosJefatura
          arbol={arbol}
          valor={elegido ? responsableId : 0}
          onCambiar={setResponsableId}
        />
        <SelectorPeriodoInicio
          valor={periodo}
          onCambiar={(nuevo) => {
            if (nuevo === periodo) return;
            setPeriodo(nuevo);
            // No mezclar los números de otro período mientras llegan los nuevos.
            setDatos(cache(consultaPeriodoInicio(nuevo, hoy)));
          }}
        />
      </header>

      <div className="min-w-0 space-y-3 rounded-2xl bg-surface-soft p-3 sm:p-5">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <h2 className="min-w-0 truncate text-xs font-bold uppercase tracking-wide text-muted sm:text-sm">
            {periodo.clave === "hoy" ? "Indicadores del día" : `Indicadores · ${cuando}`}
          </h2>
          <BotonActualizarTablero
            cargando={cargando}
            actualizado={datos ? formatoHora(datos.actualizado) : null}
            onActualizar={() => setRevision((n) => n + 1)}
          />
        </div>
        {error ? (
          <p
            role="alert"
            className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-100"
          >
            {error}{" "}
            <button
              type="button"
              onClick={() => setRevision((n) => n + 1)}
              className={`min-h-11 cursor-pointer font-semibold underline ${enfoqueTablero}`}
            >
              Reintentar
            </button>
          </p>
        ) : null}
        {!vista ? (
          cargando ? (
            <p role="status" className="py-8 text-center text-sm text-muted">
              Cargando los indicadores de tu organigrama…
            </p>
          ) : null
        ) : vista.presentismo.totalEquipo === 0 ? (
          <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">
            Todavía no hay personas de campo en tu organigrama.
          </p>
        ) : (
          <div className="grid min-w-0 grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-3">
            {tarjetas.map((k) => (
              <TarjetaIndicador
                key={k.letra}
                letra={k.letra}
                nombre={k.nombre}
                tono={k.tono}
                valor={
                  <>
                    {k.valor}
                    {k.sufijo ? (
                      <small className="text-base font-semibold text-muted">{k.sufijo}</small>
                    ) : null}
                  </>
                }
                barra={k.barra}
                nota={k.nota}
                href={href}
                etiqueta={`${k.nombre}: ver ${paginaDetalle?.nombre ?? "detalle"}`}
              />
            ))}
          </div>
        )}
      </div>

      <GruposCascada
        key={elegido ? responsableId : 0}
        nodos={subgrupos}
        metric="ruta"
        onAbrir={(n) => setResponsableId(n.persona.id)}
      />
    </section>
  );
}
