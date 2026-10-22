"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { EstadoTelefono } from "./estado-telefono";
import {
  ETIQUETA_FILTRO,
  ORDEN_RUTA,
  PRESENTISMO,
  RUTA,
} from "@/utils/estado-jornada";
import type { FiltroRuta } from "@/types/estado-jornada";
import { StatusStamp } from "./ui/status-stamp";
import { SaludoRuta } from "./ui/saludo-ruta";
import { KpisRuta } from "./ui/kpis-ruta";
import { TarjetaAgendaRepositor } from "./tarjeta-agenda-repositor";
import { ModalNovedadLocal } from "./modal-novedad-local";
import {
  IconoCaja,
  IconoCalendario,
  IconoCruz,
  IconoMapa,
  IconoMensaje,
  IconoRefrescar,
  IconoRuta,
  IconoTareas,
} from "./ui/iconos-campo";
import { formatoDistancia, metrosEntre } from "@/utils/distancia";
import {
  metrosRecorrido,
  ordenarParadasPorRuta,
  urlGoogleMapsRuta,
  type CoordenadaCampo,
  conUbicacion,
} from "@/utils/ruta-recomendada";
import { mensajeError } from "@/utils/error";
import type { MarcacionPendiente } from "@/types/seguimiento";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { usePanel } from "@/components/panel/contexto";
import { useListaCampo } from "@/hooks/use-lista-campo";
import { useFechaCampo } from "@/hooks/use-fecha-campo";
import {
  formatoFechaHora,
  formatoHora,
  queryFechasCampo,
  textoRangoFechas,
} from "@/utils/fechas";
import { SelectorFechaFiltro, type PeriodoFiltro } from "./ui/selector-fecha-filtro";
import { PantallaCarga } from "@/components/pantalla-carga";
import { btnPrimary, errorBox } from "@/components/ui";

// Acciones secundarias de la tabla: compactas, con ícono y en una fila.
const btnAccion =
  "inline-flex min-h-11 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-control-line bg-surface-raised px-3 text-xs font-semibold text-foreground transition hover:border-brand-500 hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-control-line disabled:hover:bg-surface-raised";
import { TablaCampo } from "./tabla-campo";
import type { AgendaCampo, LocalCampo, VisitaCampo } from "@/types/campo";
import { ModalMarca } from "./modal-marca";
import { TareasDeLocal } from "./tareas-de-local";

// Leaflet solo se descarga al abrir un mapa.
const MapaLocal = dynamic(
  () => import("./mapa-local").then((modulo) => modulo.MapaLocal),
  { ssr: false },
);

export function JornadaPanel({
  esRepositor = false,
}: {
  esRepositor?: boolean;
}) {
  const hoyStr = useFechaCampo();
  const [periodo, setPeriodo] = useState<PeriodoFiltro>({
    clave: "hoy",
    etiqueta: "Hoy",
    fecha: hoyStr,
    fechaInicio: hoyStr,
    fechaFin: hoyStr,
  });
  const qsFecha = periodo.clave === "hoy" ? `fecha=${hoyStr}` : queryFechasCampo(periodo) || `fecha=${hoyStr}`;
  return (
    <div className="min-w-0 w-full px-4 py-3 sm:px-6 sm:py-5 lg:px-8">
      <AgendaDelDia
        key={qsFecha}
        qsFecha={qsFecha}
        esRepositor={esRepositor}
        periodo={periodo}
        onPeriodo={setPeriodo}
      />
    </div>
  );
}
function AgendaDelDia({
  qsFecha,
  esRepositor,
  periodo,
  onPeriodo,
}: {
  qsFecha: string;
  esRepositor: boolean;
  periodo: PeriodoFiltro;
  onPeriodo: (periodo: PeriodoFiltro) => void;
}) {
  const router = useRouter();
  const { usuario, modulos } = usePanel();
  const hoyStr = useFechaCampo();
  const lista = useListaCampo<AgendaCampo>(`/campo/jornada?${qsFecha}`);
  const [expandida, setExpandida] = useState<number | null | undefined>();
  const [visitaAbierta, setAbierta] = useState<VisitaCampo | null>(null);
  const abierta = visitaAbierta?.fecha.slice(0, 10) === hoyStr ? visitaAbierta : null;
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const [mapa, setMapa] = useState<LocalCampo | null>(null);
  const [tareas, setTareas] = useState<AgendaCampo | null>(null);
  const [novedadDe, setNovedadDe] = useState<AgendaCampo | null>(null);
  // Sube al cerrar el modal de tareas para refrescar el "2/5" de la tarjeta.
  const [revisionTareas, setRevisionTareas] = useState(0);
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<FiltroRuta>("todos");
  const [marca, setMarca] = useState<{
    asignacionId: number;
    horarioId?: number;
    visitaId?: number;
    nombre: string;
    radioMetros: number;
  } | null>(null);
  // Ruta recomendada (solo sugerencia): orden de los pendientes y punto de partida.
  const [ruta, setRuta] = useState<{
    origen: CoordenadaCampo;
    ids: number[];
    metros: number;
    sinGps: boolean;
  } | null>(null);
  const [calculandoRuta, setCalculandoRuta] = useState(false);
  const [avisoRuta, setAvisoRuta] = useState("");

  useEffect(() => {
    let vigente = true;
    apiFetch<VisitaCampo | null>("/campo/jornada/abierta")
      .then((v) => {
        if (vigente) setAbierta(v);
      })
      .catch((e: Error) => {
        if (vigente) setError(e.message);
      });
    return () => {
      vigente = false;
    };
  }, [revision, hoyStr]);

  function actualizar() {
    lista.refrescar();
    setRevision((n) => n + 1);
  }

  const hoy = new URLSearchParams(qsFecha).get("fecha") === hoyStr;

  // En curso arriba, después pendientes y al final lo visitado (orden estable).
  // Con ruta calculada, los pendientes siguen el orden sugerido.
  const itemsOrdenados = useMemo(() => {
    const peso = new Map(ruta?.ids.map((id, i) => [id, i]) ?? []);
    const enRuta = (a: AgendaCampo) =>
      a.estado === "pendiente" ? (peso.get(a.id) ?? 10_000) : 0;
    return lista.items
      .map((a, i) => ({ a, i }))
      .sort(
        (x, y) =>
          ORDEN_RUTA[x.a.estado] - ORDEN_RUTA[y.a.estado] ||
          enRuta(x.a) - enRuta(y.a) ||
          x.i - y.i,
      )
      .map(({ a }) => a);
  }, [lista.items, ruta]);
  // Número de parada de cada pendiente.
  const numeroParada = useMemo(
    () =>
      new Map(
        itemsOrdenados
          .filter((a) => a.estado === "pendiente")
          .map((a, i) => [a.id, i + 1]),
      ),
    [itemsOrdenados],
  );

  function posicionGps(): Promise<CoordenadaCampo | null> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (p) =>
          resolve({ latitud: p.coords.latitude, longitud: p.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
      );
    });
  }

  async function calcularRuta() {
    if (calculandoRuta) return;
    setCalculandoRuta(true);
    setAvisoRuta("");
    try {
      const candidatos = lista.items.flatMap((a) =>
        a.estado === "pendiente" && conUbicacion(a.local)
          ? [{ ...a, local: a.local }]
          : [],
      );
      if (!candidatos.length) {
        setRuta(null);
        setAvisoRuta("No hay locales pendientes con ubicación para armar la ruta.");
        return;
      }
      const gps = await posicionGps();
      // Sin GPS se parte del local de la visita en curso o del primer pendiente.
      const localActual = lista.items.find(
        (a) => a.id === abierta?.asignacionId,
      )?.local;
      const inicio =
        gps ??
        (localActual && conUbicacion(localActual) ? localActual : null) ??
        candidatos[0].local;
      const origen = { latitud: inicio.latitud, longitud: inicio.longitud };
      const orden = ordenarParadasPorRuta(
        origen,
        candidatos.map((a) => {
          // Ventana del primer horario que todavía no tiene visita.
          const h =
            a.local.horarios.find(
              (x) => !a.visitas.some((v) => v.horarioId === x.id),
            ) ?? a.local.horarios[0];
          return {
            id: a.id,
            latitud: a.local.latitud,
            longitud: a.local.longitud,
            entrada: h?.entrada ?? "08:00",
            salida: h?.salida ?? "18:00",
          };
        }),
      );
      const paradas = orden.map(({ latitud, longitud }) => ({ latitud, longitud }));
      setRuta({
        origen,
        ids: orden.map((p) => p.id),
        metros: metrosRecorrido(origen, paradas),
        sinGps: !gps,
      });
    } catch (e) {
      setAvisoRuta(mensajeError(e, "No se pudo calcular la ruta."));
    } finally {
      setCalculandoRuta(false);
    }
  }

  // Lo que queda de la ruta: las paradas sugeridas que siguen pendientes.
  const paradasRestantes = ruta
    ? ruta.ids.flatMap((id) => {
        const a = lista.items.find((x) => x.id === id);
        return a?.estado === "pendiente" && conUbicacion(a.local)
          ? [{ ...a, local: a.local }]
          : [];
      })
    : [];
  const urlMapsRuta = ruta
    ? urlGoogleMapsRuta(
        ruta.origen,
        paradasRestantes.map((a) => ({
          latitud: a.local.latitud,
          longitud: a.local.longitud,
        })),
      )
    : "";

  // Filtrado por el KPI elegido y por búsqueda
  const itemsFiltrados = useMemo(() => {
    const porEstado =
      filtro === "todos"
        ? itemsOrdenados
        : itemsOrdenados.filter((a) => a.estado === filtro);
    if (!busqueda.trim()) return porEstado;
    const q = busqueda.toLowerCase();
    return porEstado.filter(
      (a) =>
        a.local.nombre.toLowerCase().includes(q) ||
        a.local.id.toLowerCase().includes(q) ||
        a.local.direccion.toLowerCase().includes(q),
    );
  }, [itemsOrdenados, busqueda, filtro]);

  // Se abre sola la tarjeta en curso hasta que el usuario elige otra.
  const idExpandida =
    expandida === undefined
      ? (abierta && itemsOrdenados.some((a) => a.id === abierta.asignacionId)
          ? abierta.asignacionId
          : (itemsOrdenados.find((a) => a.estado === "en_curso")?.id ?? null))
      : expandida;

  const paginasJornada =
    modulos.find((m) => m.ruta === "mi-jornada")?.paginas ?? [];
  const rutaTareas = paginasJornada.some((p) => p.ruta === "tareas")
    ? "/panel/mi-jornada/tareas"
    : null;
  const rutaInventario = paginasJornada.some((p) => p.ruta === "inventario")
    ? "/panel/mi-jornada/inventario"
    : null;

  // Métricas del día
  const visitadas = lista.items.filter((a) =>
    a.estado === "completado",
  ).length;
  const enCurso = lista.items.filter(a => a.estado === "en_curso").length;
  const pendientes = lista.items.filter(a => a.estado === "pendiente").length;
  const total = lista.datos?.total;
  const porPagina = (lista.datos?.totalPages ?? 1) > 1;
  const locales = (n: number) => `${n} ${n === 1 ? "local" : "locales"}`;
  const resumen =
    total === undefined
      ? "Cargando tu ruta…"
      : hoy && total > 0 && visitadas === total
        ? `Completaste ${total === 1 ? "el local" : `los ${total} locales`} de tu ruta`
        : hoy
          ? `Hoy tenés ${locales(total)} en tu ruta`
          : `${periodo.etiqueta}: ${locales(total)} en tu ruta`;
  const inicioPeriodo = periodo.fechaInicio ?? periodo.fecha ?? hoyStr;
  const finPeriodo = periodo.fechaFin ?? periodo.fecha ?? inicioPeriodo;

  return (
    <>
      {error ? <p className={errorBox}>{error}</p> : null}

      <SaludoRuta
        nombre={usuario.nombre.trim().split(/\s+/)[0] ?? ""}
        fechaTexto={textoRangoFechas(inicioPeriodo, finPeriodo)}
        resumen={resumen}
      >
        <SelectorFechaFiltro valorActual={periodo} onChange={onPeriodo} />
      </SaludoRuta>

      <div className="mb-2 mt-2 sm:mb-3 sm:mt-3">
        <KpisRuta
          total={total ?? "—"}
          visitadas={visitadas}
          enCurso={enCurso}
          pendientes={pendientes}
          incompletas={lista.items.filter(a => a.estado === "incompleto").length}
          ausentes={lista.items.filter(a => a.estado === "ausente").length}
          sufijo={hoy ? "hoy" : "en el período"}
          porPagina={porPagina}
          filtro={filtro}
          onFiltro={setFiltro}
        />
      </div>

      {/* Banner de visita en curso */}
      {abierta ? (
        <div className="mb-2 flex min-w-0 items-center gap-2 rounded-lg border border-sky-500 bg-sky-50/60 px-3 py-1 sm:mb-3 dark:border-sky-700 dark:bg-sky-950/40">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-sky-600 dark:bg-sky-400" />
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-foreground" title={`Visita en curso · ${abierta.local.nombre}`}>
                En curso · {abierta.local.nombre}
              </p>
              <p className="truncate text-[11px] text-muted font-mono">
                Entrada: {formatoFechaHora(abierta.entrada)}
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label={`Marcar salida de ${abierta.local.nombre}`}
            className="flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-line bg-surface-raised px-3 text-xs font-semibold text-foreground transition hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus dark:border-line dark:bg-surface-raised dark:text-foreground dark:hover:bg-surface-soft"
            onClick={() =>
              setMarca({
                asignacionId: abierta.asignacionId,
                visitaId: abierta.id,
                nombre: abierta.local.nombre,
                radioMetros: abierta.local.radioMetros,
              })
            }
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Salida
          </button>
        </div>
      ) : null}

      {/* Buscador de locales de la agenda */}
      <div className={`mb-2 flex min-w-0 w-full items-center gap-2 sm:mb-3 ${esRepositor ? "" : "flex-wrap sm:justify-between"}`}>
        <div className={`relative min-w-0 flex-1 ${esRepositor ? "" : "sm:max-w-sm"}`}>
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted">
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="2"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            aria-label="Buscar local en esta página de la agenda"
            name="buscar-local"
            autoComplete="off"
            placeholder={esRepositor ? "Buscar local…" : "Buscar en esta página…"}
            className={`h-11 min-h-11 w-full rounded-lg border border-line bg-surface-raised py-2 pl-9 ${busqueda ? "pr-11" : "pr-3"} text-base text-foreground outline-none transition-colors placeholder:text-muted focus-visible:border-brand-600 focus-visible:ring-2 focus-visible:ring-brand-600/30 sm:text-sm dark:border-line dark:bg-surface-raised dark:text-foreground`}
          />
          {busqueda && (
            <button
              type="button"
              onClick={() => setBusqueda("")}
              aria-label="Limpiar búsqueda de locales"
              className="absolute inset-y-0 right-0 flex min-w-11 items-center justify-center rounded-r-xl text-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              title="Limpiar búsqueda"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth="2"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
        {esRepositor ? (
          <EstadoTelefono variante="boton" />
        ) : (
          <div className="hidden text-xs text-muted sm:block">
            <span>{itemsFiltrados.length} locales visibles en esta página</span>
          </div>
        )}
      </div>

      <div className="mb-2 flex min-h-11 min-w-0 items-center justify-between gap-2 px-0.5">
        <h2 className="flex min-w-0 items-center gap-1.5 text-[13px] font-bold text-foreground sm:text-sm">
          <IconoCalendario className="h-4 w-4 shrink-0 text-brand-700 dark:text-brand-200" />
          <span className="truncate">
            {hoy ? "Agenda del día" : `Agenda · ${periodo.etiqueta}`}
            {filtro !== "todos" ? ` · ${ETIQUETA_FILTRO[filtro]}` : ""}
          </span>
        </h2>
        <div className="flex shrink-0 items-center gap-2">
          {lista.datos && (busqueda.trim() || filtro !== "todos") ? (
            <span className="text-[11px] text-muted sm:text-xs">
              {itemsFiltrados.length} de {lista.items.length}
            </span>
          ) : null}
          {hoy && !ruta ? (
            <button
              type="button"
              onClick={() => void calcularRuta()}
              disabled={calculandoRuta || lista.cargando}
              className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-brand-200 bg-brand-50 px-3 text-xs font-semibold text-brand-800 transition-colors hover:border-brand-500 hover:bg-brand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50 dark:border-brand-800 dark:bg-brand-950/50 dark:text-brand-100 dark:hover:border-brand-500 dark:hover:bg-brand-900"
            >
              <IconoRuta className="h-4 w-4 shrink-0" />
              Calcular ruta
            </button>
          ) : null}
        </div>
      </div>

      {ruta ? (
        <section
          aria-label="Ruta sugerida"
          className="mb-2 rounded-xl border border-brand-200 bg-brand-50 p-3 dark:border-brand-800 dark:bg-brand-950/50 sm:mb-3"
        >
          <div className="flex min-w-0 items-start gap-2.5">
            <span
              aria-hidden="true"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-700 text-white dark:bg-brand-500 dark:text-brand-950"
            >
              <IconoRuta className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-foreground sm:text-sm">
                Ruta sugerida · {ruta.ids.length}{" "}
                {ruta.ids.length === 1 ? "parada" : "paradas"} ·{" "}
                {formatoDistancia(ruta.metros)} aprox.
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-muted sm:text-xs">
                {paradasRestantes[0] ? (
                  <>
                    Seguí por{" "}
                    <b className="text-foreground">{paradasRestantes[0].local.nombre}</b>
                    {`, a ${formatoDistancia(metrosEntre(ruta.origen, paradasRestantes[0].local))}. `}
                  </>
                ) : (
                  "Ya pasaste por todas las paradas sugeridas. "
                )}
                {ruta.sinGps
                  ? "Sin GPS: ordenamos por horarios y distancia entre locales. "
                  : "Según tu ubicación, los horarios y la distancia. "}
                Es una recomendación: podés ir en el orden que prefieras.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setRuta(null)}
              aria-label="Quitar ruta sugerida"
              title="Quitar ruta sugerida"
              className="-mr-1.5 -mt-1.5 grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-lg text-muted transition-colors hover:bg-brand-100 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus dark:hover:bg-brand-900"
            >
              <IconoCruz className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-2.5 flex gap-2">
            {urlMapsRuta ? (
              <a
                href={urlMapsRuta}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-11 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-brand-700 px-3 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus dark:bg-brand-500 dark:text-brand-950 dark:hover:brightness-110 sm:text-sm"
              >
                <IconoMapa className="h-4 w-4 shrink-0" />
                Abrir en Maps
              </a>
            ) : null}
            <button
              type="button"
              onClick={() => void calcularRuta()}
              disabled={calculandoRuta}
              className="flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-brand-200 bg-surface-raised px-3 text-[13px] font-semibold text-foreground transition-colors hover:border-brand-500 hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50 dark:border-brand-800 sm:text-sm"
            >
              <IconoRefrescar className="h-4 w-4 shrink-0" />
              Recalcular
            </button>
          </div>
        </section>
      ) : avisoRuta ? (
        <p
          role="status"
          className="mb-2 rounded-lg border border-line bg-surface-soft px-3 py-2 text-xs text-foreground sm:mb-3"
        >
          {avisoRuta}
        </p>
      ) : null}

      <TablaCampo
        lista={{ ...lista, items: itemsFiltrados }}
        etiqueta="Agenda"
        columnas={[
          {
            titulo: "Local",
            valor: (a) => (
              <div className="flex items-center gap-2.5">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line bg-surface-soft text-foreground">
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth="1.8"
                    aria-hidden="true"
                  >
                    <path d="M4 10 5 4h14l1 6" />
                    <rect x="4" y="10" width="16" height="10" rx="1" />
                    <line x1="9" y1="20" x2="9" y2="14" />
                    <line x1="15" y1="14" x2="15" y2="20" />
                  </svg>
                </div>
                <div>
                  <strong className="block font-semibold text-foreground">
                    {a.local.nombre}
                  </strong>
                  <p className="text-xs text-brand-700 dark:text-brand-200 font-medium">
                    {a.local.direccion || a.local.id}
                  </p>
                </div>
              </div>
            ),
          },
          {
            titulo: "Visita",
            valor: (a) => {
              const enCurso =
                abierta?.asignacionId === a.id
                  ? abierta.entrada
                  : a.visitas.find((v) => v.estado === "EN_CURSO")?.entrada;
              const ultima = a.visitas.at(-1);
              const parada = numeroParada.get(a.id);
              return (
                <div className="min-w-0 space-y-0.5 text-xs">
                  <p className="font-semibold text-foreground">
                    {enCurso
                      ? `En el local desde ${formatoHora(enCurso)}`
                      : a.estado === "completado" && ultima
                        ? `Visitado ${formatoHora(ultima.entrada)}–${formatoHora(ultima.salida)}`
                        : ruta && parada && conUbicacion(a.local)
                          ? `Parada ${parada} · a ${formatoDistancia(metrosEntre(ruta.origen, a.local))}`
                          : "Sin visita todavía"}
                  </p>
                  {a.esBackup ? (
                    <p className="text-muted">Reemplazás a {a.titular}</p>
                  ) : null}
                </div>
              );
            },
          },
          {
            titulo: "Horario de Atención",
            valor: (a) =>
              a.local.horarios.length ? (
                <div className="flex flex-wrap gap-1 font-mono text-xs">
                  {a.local.horarios.map((h) => (
                    <span
                      key={h.id}
                      className="inline-flex items-center gap-1 rounded bg-surface-soft px-2 py-0.5"
                    >
                      <svg
                        className="h-3 w-3 text-muted shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        strokeWidth="2"
                        aria-hidden="true"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      {h.entrada}–{h.salida}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-muted">Sin horario fijado</span>
              ),
          },
          {
            titulo: "Estado",
            valor: (a) => {
              return <div className="flex flex-wrap gap-1"><StatusStamp tone={RUTA[a.estado].tone}>{RUTA[a.estado].etiqueta}</StatusStamp>
                <StatusStamp tone={PRESENTISMO[a.estadoPresentismo].tone}>{PRESENTISMO[a.estadoPresentismo].etiqueta}</StatusStamp></div>;
            },
          },
        ]}
        tarjetaMovil={(a) => (
          <TarjetaAgendaRepositor
            agenda={a}
            orden={numeroParada.get(a.id) ?? 0}
            distancia={
              ruta && a.estado === "pendiente" && conUbicacion(a.local)
                ? formatoDistancia(metrosEntre(ruta.origen, a.local))
                : undefined
            }
            abierta={idExpandida === a.id}
            alternar={() => setExpandida(idExpandida === a.id ? null : a.id)}
            hoy={hoy}
            qsFecha={qsFecha}
            revisionTareas={revisionTareas}
            visitaAbierta={abierta}
            rutaTareas={rutaTareas}
            rutaInventario={rutaInventario}
            onEntrada={(horarioId) =>
              setMarca({
                asignacionId: a.id,
                horarioId,
                nombre: a.local.nombre,
                radioMetros: a.local.radioMetros,
              })
            }
            onSalida={(v) =>
              setMarca({
                asignacionId: v.asignacionId,
                visitaId: v.id,
                nombre: v.local.nombre,
                radioMetros: v.local.radioMetros,
              })
            }
            onTareas={() => setTareas(a)}
            onMapa={() => setMapa(a.local)}
            onNovedad={() => setNovedadDe(a)}
          />
        )}
        acciones={(a) => {
          const aqui = abierta?.asignacionId === a.id;
          // Un solo "Marcar entrada": el del próximo horario sin visita.
          const proximo =
            hoy && !abierta
              ? (a.local.horarios.length ? a.local.horarios : [null]).find(
                  (h) =>
                    !a.visitas.some((v) => v.horarioId === (h?.id ?? null)),
                )
              : undefined;
          return (
            <div className="flex min-w-[17rem] flex-col items-start gap-2">
              {aqui ? (
                <button
                  className={btnPrimary}
                  onClick={() =>
                    setMarca({
                      asignacionId: abierta.asignacionId,
                      visitaId: abierta.id,
                      nombre: abierta.local.nombre,
                      radioMetros: abierta.local.radioMetros,
                    })
                  }
                >
                  Marcar salida
                </button>
              ) : proximo !== undefined ? (
                <button
                  className={btnPrimary}
                  onClick={() =>
                    setMarca({
                      asignacionId: a.id,
                      horarioId: proximo?.id,
                      nombre: a.local.nombre,
                      radioMetros: a.local.radioMetros,
                    })
                  }
                >
                  Marcar entrada
                </button>
              ) : null}
              <div className="flex flex-wrap gap-1.5">
                <button
                  className={btnAccion}
                  onClick={() => setMapa(a.local)}
                >
                  <IconoMapa className="h-4 w-4" />
                  Mapa
                </button>
                <button
                  className={btnAccion}
                  onClick={() => setTareas(a)}
                  disabled={!aqui}
                  title={aqui ? undefined : "Marcá entrada para ver las tareas"}
                >
                  <IconoTareas className="h-4 w-4" />
                  Tareas
                </button>
                {rutaInventario ? (
                  aqui ? (
                    <Link
                      href={`${rutaInventario}?local=${encodeURIComponent(a.local.id)}`}
                      className={btnAccion}
                    >
                      <IconoCaja className="h-4 w-4" />
                      Inventario
                    </Link>
                  ) : (
                    <button
                      className={btnAccion}
                      disabled
                      title="Marcá entrada para usar el inventario"
                    >
                      <IconoCaja className="h-4 w-4" />
                      Inventario
                    </button>
                  )
                ) : null}
                <button
                  className={btnAccion}
                  onClick={() => setNovedadDe(a)}
                >
                  <IconoMensaje className="h-4 w-4" />
                  Novedad
                </button>
              </div>
            </div>
          );
        }}
      />
      <PantallaCarga
        visible={calculandoRuta}
        mensaje="Calculando mejor ruta"
        detalle="Usamos tu GPS, los horarios y la distancia entre locales."
      />
      {mapa ? <MapaLocal local={mapa} cerrar={() => setMapa(null)} /> : null}
      {novedadDe ? (
        <ModalNovedadLocal
          local={novedadDe.local}
          visitaId={
            abierta?.asignacionId === novedadDe.id ? abierta.id : undefined
          }
          cerrar={() => setNovedadDe(null)}
        />
      ) : null}
      {tareas ? (
        <TareasDeLocal
          agenda={tareas}
          qsFecha={qsFecha}
          abierta={abierta}
          cerrar={() => {
            setTareas(null);
            setRevisionTareas((n) => n + 1);
          }}
        />
      ) : null}
      {marca ? (
        <ModalMarca
          nombre={marca.nombre}
          radioMetros={marca.radioMetros}
          salida={!!marca.visitaId}
          usarTelefonoUcheck={esRepositor}
          alConfirmarPendiente={() => {
            actualizar();
            setMarca(null);
          }}
          cerrar={() => setMarca(null)}
          guardar={async (datos) => {
            const resultado = await apiFetch<{
              estado?: "CONFIRMADA" | "PENDIENTE";
              mensaje?: string;
              operacionId?: string;
            }>(
              marca.visitaId
                ? esRepositor
                  ? `/campo/jornada/repositor/visitas/${marca.visitaId}/salida`
                  : `/campo/jornada/visitas/${marca.visitaId}/salida`
                : esRepositor
                  ? "/campo/jornada/repositor/entrada"
                  : "/campo/jornada/entrada",
              {
                method: "POST",
                body: JSON.stringify({
                  ...datos,
                  ...(!marca.visitaId
                    ? {
                        asignacionId: marca.asignacionId,
                        horarioId: marca.horarioId,
                      }
                    : {}),
                }),
              },
            );
            if (resultado.estado === "PENDIENTE" && resultado.operacionId)
              return {
                estado: "PENDIENTE",
                operacionId: resultado.operacionId,
                mensaje:
                  resultado.mensaje ??
                  "Marcación guardada en Ucheck, pendiente de sincronización.",
              } satisfies MarcacionPendiente;
            actualizar();
            setMarca(null);
            if (esRepositor && !marca.visitaId)
              router.push("/panel/mi-jornada/tareas");
          }}
        />
      ) : null}
    </>
  );
}
