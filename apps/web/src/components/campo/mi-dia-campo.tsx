"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { usePanel } from "@/components/panel/contexto";
import { BarraSegmentos, RAYADO_EN_CURSO } from "./ui/barra-segmentos";
import {
  EncabezadoTablero,
  FilaAtencion,
  ListaAtencion,
  PRESENTISMO_UI,
  RUTA_PILL,
  SeccionTablero,
  TarjetaIndicador,
  enfoqueTablero,
} from "./ui/tablero-campo";
import {
  IconoAlerta,
  IconoMegafono,
  IconoPlay,
  IconoReloj,
  IconoSalida,
  IconoTareas,
  IconoTienda,
} from "./ui/iconos-campo";
import { RUTA } from "@/utils/estado-jornada";
import { fechaEnZonaIso, formatoDiaLargo, formatoHora } from "@/utils/fechas";
import { pct, resumenMiDia } from "@/utils/hoy-en-campo";
import { tareaCumplidaEnVisita } from "@/utils/tareas-campo";
import type {
  AgendaCampo,
  AvisoRecibidoItem,
  NovedadesResponse,
  TareaJornadaCampo,
  VisitaCampo,
} from "@/types/campo";
import type { RespuestaPaginada } from "@/types/paginacion";

// Inicio del repositor o impulsador: los mismos indicadores del supervisor,
// pero solo con su propio día (ruta, presentismo, tareas y novedades).

const ACTUALIZAR_CADA_MS = 5 * 60_000;

interface DatosMiDia {
  agenda: AgendaCampo[];
  /** Visita abierta, sea de hoy o de una jornada anterior. */
  abierta: VisitaCampo | null;
  tareas: TareaJornadaCampo[] | null;
  novedadesAbiertas: number | null;
  primeraNovedad: string | null;
  avisos: AvisoRecibidoItem[] | null;
  actualizado: string;
}

export function MiDiaCampo() {
  const { usuario, modulos } = usePanel();
  const pagina = (ruta: string) =>
    modulos.some((m) => m.ruta === "mi-jornada" && m.paginas.some((p) => p.ruta === ruta));
  const rutaRuta = pagina("locales")
    ? "/panel/mi-jornada/locales"
    : pagina("agenda")
      ? "/panel/mi-jornada/agenda"
      : null;
  const rutaTareas = pagina("tareas") ? "/panel/mi-jornada/tareas" : null;
  const rutaNovedades = pagina("novedades") ? "/panel/mi-jornada/novedades" : null;
  const rutaAvisos = pagina("avisos") ? "/panel/mi-jornada/avisos" : null;
  const hoy = fechaEnZonaIso(new Date());

  const [revision, setRevision] = useState(0);
  const [terminada, setTerminada] = useState(-1);
  const [datos, setDatos] = useState<DatosMiDia | null>(null);
  const [error, setError] = useState("");
  const cargando = terminada !== revision;
  const actualizar = () => setRevision((n) => n + 1);

  useEffect(() => {
    const controller = new AbortController();
    const opciones = { signal: controller.signal };
    const fecha = fechaEnZonaIso(new Date());
    async function cargar() {
      const [agenda, abierta, novedades, avisos] = await Promise.all([
        apiFetch<RespuestaPaginada<AgendaCampo>>(`/campo/jornada?fecha=${fecha}&page=1&limit=50`, opciones),
        apiFetch<VisitaCampo | null>("/campo/jornada/abierta", opciones),
        rutaNovedades
          ? apiFetch<NovedadesResponse>("/campo/novedades?estado=ABIERTA&page=1&limit=1", opciones).catch(() => null)
          : Promise.resolve(null),
        rutaAvisos
          ? apiFetch<RespuestaPaginada<AvisoRecibidoItem>>("/campo/avisos/recibidos?page=1&limit=20", opciones).catch(() => null)
          : Promise.resolve(null),
      ]);
      // Las tareas solo se trabajan con la visita abierta de hoy.
      const visitaHoy = abierta && abierta.fecha.slice(0, 10) === fecha ? abierta : null;
      const tareas = visitaHoy
        ? await apiFetch<RespuestaPaginada<TareaJornadaCampo>>(
            `/campo/jornada/asignaciones/${visitaHoy.asignacionId}/tareas?fecha=${fecha}&page=1&limit=50`,
            opciones,
          )
            .then((r) => r.items)
            .catch(() => null)
        : null;
      if (controller.signal.aborted) return;
      setDatos({
        agenda: agenda.items,
        abierta,
        tareas,
        novedadesAbiertas: novedades ? novedades.counts.abierta : null,
        primeraNovedad: novedades?.items[0]?.titulo ?? null,
        avisos: avisos?.items ?? null,
        actualizado: new Date().toISOString(),
      });
      setError("");
    }
    cargar()
      .catch((e: unknown) => {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : "No se pudo cargar tu día");
      })
      .finally(() => {
        if (!controller.signal.aborted) setTerminada(revision);
      });
    return () => controller.abort();
  }, [revision, rutaNovedades, rutaAvisos]);

  // Se actualiza solo cada 5 minutos mientras la pestaña está visible.
  useEffect(() => {
    const reloj = setInterval(() => {
      if (!document.hidden) setRevision((n) => n + 1);
    }, ACTUALIZAR_CADA_MS);
    return () => clearInterval(reloj);
  }, []);

  const agenda = useMemo(() => datos?.agenda ?? [], [datos]);
  const r = useMemo(() => resumenMiDia(agenda), [agenda]);
  const visitaHoy = datos?.abierta && datos.abierta.fecha.slice(0, 10) === hoy ? datos.abierta : null;
  const visitaVieja = datos?.abierta && !visitaHoy ? datos.abierta : null;
  const localVisita = visitaHoy ? agenda.find((a) => a.id === visitaHoy.asignacionId) : undefined;
  const tareas = datos?.tareas ?? null;
  const hechas = tareas ? tareas.filter((t) => tareaCumplidaEnVisita(t, visitaHoy?.id)).length : 0;
  const obligPend = tareas
    ? tareas.filter((t) => t.esObligatoria && !tareaCumplidaEnVisita(t, visitaHoy?.id)).length
    : 0;
  const proximo = agenda.find((a) => a.estado === "pendiente");
  const avisosSinLeer = datos?.avisos?.filter((a) => !a.leido) ?? [];
  const novedadesAbiertas = datos?.novedadesAbiertas ?? null;
  const ui = PRESENTISMO_UI[r.presentismo];
  const nombre = usuario.nombre.trim().split(/\s+/)[0] ?? "";

  return (
    <section aria-label="Tu día" className="min-w-0 space-y-4 sm:space-y-5">
      <EncabezadoTablero
        rotulo={`${usuario.rol?.descripcion ?? "Mi jornada"} · ${usuario.empresa.nombre}`}
        titulo={nombre ? `¡Hola, ${nombre}!` : "Tu día"}
        subtitulo={`${formatoDiaLargo(hoy)}${datos ? ` · ${r.total} ${r.total === 1 ? "local" : "locales"} en tu ruta` : ""}`}
        cargando={cargando}
        actualizado={datos ? formatoHora(datos.actualizado) : null}
        onActualizar={actualizar}
      />

      {error ? (
        <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-100">
          {error}{" "}
          <button type="button" onClick={actualizar} className={`font-semibold underline ${enfoqueTablero}`}>
            Reintentar
          </button>
        </p>
      ) : null}

      {!datos ? (
        cargando ? (
          <p role="status" className="py-8 text-center text-sm text-muted">
            Cargando tu día…
          </p>
        ) : null
      ) : (
        <>
          <div>
            <p className="mb-2 flex items-baseline justify-between gap-2 px-0.5">
              <span className="text-[11px] font-bold uppercase tracking-wide text-muted">Tus indicadores de hoy</span>
              <span className="text-[11px] text-muted sm:text-xs">Tocá para ir al detalle</span>
            </p>
            <div className="grid min-w-0 grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-3">
              <TarjetaIndicador
                letra="A"
                nombre="Mi ruta"
                etiqueta="Ir a Mi Ruta"
                href={rutaRuta ?? undefined}
                tono={r.ausentes ? "bad" : r.incompletas ? "warn" : "ok"}
                valor={
                  <>
                    {r.completadas}
                    <small className="text-base font-semibold text-muted">/{r.total}</small>
                  </>
                }
                barra={
                  <BarraSegmentos
                    total={r.total}
                    segmentos={[
                      { valor: r.completadas, clase: "bg-emerald-600 dark:bg-emerald-500", etiqueta: "visitados" },
                      { valor: r.enCurso, clase: RAYADO_EN_CURSO, etiqueta: "en curso" },
                      { valor: r.incompletas, clase: "bg-orange-500 dark:bg-orange-400", etiqueta: "sin salida" },
                      { valor: r.ausentes, clase: "bg-red-600 dark:bg-red-500", etiqueta: "sin visitar" },
                    ]}
                  />
                }
                nota={
                  <>
                    <b className="text-foreground">{r.enCurso} en curso</b> · {r.pendientes} pendientes
                    {r.ausentes ? <span className="font-semibold text-red-700 dark:text-red-300"> · {r.ausentes} sin visitar</span> : null}
                  </>
                }
              />
              <TarjetaIndicador
                letra="B"
                nombre="Presentismo"
                etiqueta="Ir a Mi Ruta"
                href={rutaRuta ?? undefined}
                tono={ui.tono}
                valor={<span className="text-2xl sm:text-3xl">{ui.etiqueta}</span>}
                barra={
                  <span className={`block h-2 w-full rounded-full ${r.presentismo === "SIN_REGISTRO" ? "bg-stone-200 dark:bg-stone-700" : ui.barra}`} />
                }
                nota={
                  r.primeraEntrada ? (
                    <>
                      Primera entrada <b className="font-mono text-foreground">{formatoHora(r.primeraEntrada)}</b>
                    </>
                  ) : (
                    "Todavía no marcaste entrada hoy"
                  )
                }
              />
              <TarjetaIndicador
                letra="C"
                nombre="Tareas"
                etiqueta="Ir a Mis tareas"
                href={rutaTareas ?? undefined}
                tono={!tareas ? "info" : obligPend ? "warn" : "ok"}
                valor={
                  tareas ? (
                    <>
                      {pct(hechas, tareas.length)}
                      <small className="text-base font-semibold text-muted">%</small>
                    </>
                  ) : (
                    "—"
                  )
                }
                barra={
                  <BarraSegmentos
                    total={tareas?.length ?? 0}
                    segmentos={[{ valor: hechas, clase: "bg-brand-600 dark:bg-brand-500", etiqueta: "hechas" }]}
                  />
                }
                nota={
                  tareas ? (
                    <>
                      <b className="text-foreground">{hechas} de {tareas.length}</b> hechas
                      {obligPend ? <span className="font-semibold text-amber-700 dark:text-amber-300"> · {obligPend} obligatorias</span> : null}
                    </>
                  ) : (
                    "Las empezás al marcar entrada"
                  )
                }
              />
              {novedadesAbiertas !== null || !datos.avisos ? (
                <TarjetaIndicador
                  letra="D"
                  nombre="Novedades"
                  etiqueta="Ir a Novedades"
                  href={rutaNovedades ?? undefined}
                  tono={novedadesAbiertas ? "warn" : avisosSinLeer.length ? "info" : "ok"}
                  valor={
                    <>
                      {novedadesAbiertas ?? "—"}
                      <small className="text-base font-semibold text-muted"> abiertas</small>
                    </>
                  }
                  nota={
                    datos.avisos ? (
                      <>
                        {avisosSinLeer.length ? (
                          <span className="font-semibold text-sky-700 dark:text-sky-300">{avisosSinLeer.length} avisos sin leer</span>
                        ) : (
                          "Avisos al día"
                        )}
                      </>
                    ) : (
                      "Reportes en seguimiento"
                    )
                  }
                />
              ) : (
                <TarjetaIndicador
                  letra="D"
                  nombre="Avisos"
                  etiqueta="Ir a Avisos"
                  href={rutaAvisos ?? undefined}
                  tono={avisosSinLeer.length ? "info" : "ok"}
                  valor={
                    <>
                      {avisosSinLeer.length}
                      <small className="text-base font-semibold text-muted"> sin leer</small>
                    </>
                  }
                  nota={`${datos.avisos.length} recibidos recientes`}
                />
              )}
            </div>
          </div>

          <div className="grid min-w-0 gap-4 lg:grid-cols-2 lg:items-start">
            <SeccionTablero
              titulo="Atender ahora"
              resumen={visitaHoy ? "Visita en curso" : proximo ? "Próximo local" : "Todo en orden"}
              destacado={!!visitaVieja || r.incompletas > 0}
            >
              <ListaAtencion
                vacio={
                  !visitaHoy && !visitaVieja && !proximo && !obligPend && !avisosSinLeer.length && !novedadesAbiertas && !r.incompletas
                }
              >
                {visitaHoy ? (
                  <FilaAtencion
                    tono="info"
                    icono={<IconoPlay />}
                    titulo={`Visita en curso en ${visitaHoy.local.nombre}`}
                    detalle={`Desde ${formatoHora(visitaHoy.entrada)}${tareas ? ` · tareas ${hechas}/${tareas.length}` : ""}`}
                    accion="Continuar"
                    href={rutaTareas ?? rutaRuta ?? undefined}
                  />
                ) : null}
                {visitaVieja ? (
                  <FilaAtencion
                    tono="bad"
                    icono={<IconoSalida />}
                    titulo="Quedó abierta una visita de otro día"
                    detalle={`${visitaVieja.local.nombre} · entrada ${formatoHora(visitaVieja.entrada)}`}
                    accion="Revisar"
                    href={rutaRuta ?? undefined}
                  />
                ) : null}
                {agenda
                  .filter((a) => a.estado === "incompleto")
                  .slice(0, 2)
                  .map((a) => (
                    <FilaAtencion
                      key={`incompleto-${a.id}`}
                      tono="warn"
                      icono={<IconoReloj />}
                      titulo={`Visita sin salida en ${a.local.nombre}`}
                      detalle="Quedó sin marcar la salida"
                      accion="Ver"
                      href={rutaRuta ?? undefined}
                    />
                  ))}
                {!visitaHoy && proximo ? (
                  <FilaAtencion
                    tono="ok"
                    icono={<IconoTienda />}
                    titulo={`Próximo local: ${proximo.local.nombre}`}
                    detalle={proximo.local.direccion || proximo.local.cliente?.nombre || "Sin dirección cargada"}
                    accion="Ir"
                    href={rutaRuta ?? undefined}
                  />
                ) : null}
                {obligPend ? (
                  <FilaAtencion
                    tono="warn"
                    icono={<IconoTareas />}
                    titulo={`${obligPend} ${obligPend === 1 ? "tarea obligatoria pendiente" : "tareas obligatorias pendientes"}`}
                    detalle={localVisita ? `En ${localVisita.local.nombre}` : "De la visita en curso"}
                    accion="Ver"
                    href={rutaTareas ?? undefined}
                  />
                ) : null}
                {avisosSinLeer.length ? (
                  <FilaAtencion
                    tono="info"
                    icono={<IconoMegafono />}
                    titulo={`${avisosSinLeer.length} ${avisosSinLeer.length === 1 ? "aviso sin leer" : "avisos sin leer"}`}
                    detalle={avisosSinLeer[0].mensaje}
                    accion="Leer"
                    href={rutaAvisos ?? undefined}
                  />
                ) : null}
                {novedadesAbiertas ? (
                  <FilaAtencion
                    tono="info"
                    icono={<IconoAlerta />}
                    titulo={`${novedadesAbiertas} ${novedadesAbiertas === 1 ? "novedad en seguimiento" : "novedades en seguimiento"}`}
                    detalle={datos.primeraNovedad ?? "Esperando respuesta de tu supervisor"}
                    accion="Ver"
                    href={rutaNovedades ?? undefined}
                  />
                ) : null}
              </ListaAtencion>
            </SeccionTablero>

            <SeccionTablero titulo="Tu ruta de hoy" resumen={`${r.completadas} de ${r.total} visitados`}>
              {agenda.length ? (
                <ul className="overflow-hidden rounded-2xl border border-line bg-surface-raised shadow-[0_2px_8px_rgba(var(--warm-shadow),0.06)]">
                  {agenda.slice(0, 8).map((a, i) => (
                    <li key={a.id} className="flex min-w-0 items-center gap-3 border-t border-line px-3 py-2.5 first:border-t-0">
                      <span
                        aria-hidden="true"
                        className={`ft-display grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${RUTA_PILL[a.estado]}`}
                      >
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold text-foreground sm:text-sm">{a.local.nombre}</span>
                        <span className="block truncate text-[11px] text-muted">{a.local.cliente?.nombre ?? a.local.direccion}</span>
                      </span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${RUTA_PILL[a.estado]}`}>
                        {RUTA[a.estado].etiqueta}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-xl border border-dashed border-line p-4 text-center text-sm text-muted">
                  No tenés locales asignados para hoy.
                </p>
              )}
              {rutaRuta && agenda.length ? (
                <Link
                  href={rutaRuta}
                  className={`flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-line bg-surface-raised px-3 text-sm font-semibold text-foreground transition-colors hover:border-brand-500 hover:bg-surface-soft ${enfoqueTablero}`}
                >
                  Ver todo en Mi Ruta <span aria-hidden="true">→</span>
                </Link>
              ) : null}
            </SeccionTablero>
          </div>
        </>
      )}
    </section>
  );
}
