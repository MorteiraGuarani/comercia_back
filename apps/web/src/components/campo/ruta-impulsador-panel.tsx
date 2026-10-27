"use client";
import type { PeriodoFiltro } from "@/types/periodo-filtro";
import dynamic from "next/dynamic";

import { useEffect, useState, useMemo } from "react";
import { apiFetch } from "@/lib/api";
import { useJornadaCompleta } from "@/hooks/use-jornada-completa";
import { useFechaCampo } from "@/hooks/use-fecha-campo";
import {
  formatoFechaHora,
  formatoHora,
  queryFechasCampo,
  textoRangoFechas,
} from "@/utils/fechas";
import { usePanel } from "@/components/panel/contexto";
import type { FiltroRuta } from "@/types/estado-jornada";
import { formatoDistancia, metrosEntre } from "@/utils/distancia";
import {
  conUbicacion,
  metrosRecorrido,
  ordenarParadasPorRuta,
  urlGoogleMapsRuta,
  type CoordenadaCampo,
} from "@/utils/ruta-recomendada";
import { mensajeError } from "@/utils/error";
import { ETIQUETA_FILTRO, ORDEN_RUTA } from "@/utils/estado-jornada";
import { EstadoRutaSimple } from "./ui/estado-ruta-simple";
import { SaludoRuta } from "./ui/saludo-ruta";
import { KpisRuta } from "./ui/kpis-ruta";
import { TarjetaAgendaRepositor } from "./tarjeta-agenda-repositor";
import { TablaCampo } from "./tabla-campo";
import {
  IconoCalendario,
  IconoCruz,
  IconoMapa,
  IconoMensaje,
  IconoRefrescar,
  IconoRuta,
} from "./ui/iconos-campo";
import { SelectorFechaFiltro } from "./ui/selector-fecha-filtro";
import { PantallaCarga } from "@/components/pantalla-carga";
import type { AgendaCampo, LocalCampo, VisitaCampo } from "@/types/campo";
import { ModalNovedadLocal } from "./modal-novedad-local";

// Leaflet solo se descarga al abrir un mapa.
const MapaLocal = dynamic(
  () => import("./mapa-local").then((modulo) => modulo.MapaLocal),
  { ssr: false },
);

export function RutaImpulsadorPanel() {
  const hoyStr = useFechaCampo();
  const [periodo, setPeriodo] = useState<PeriodoFiltro>({
    clave: "hoy",
    etiqueta: "Hoy",
    fecha: hoyStr,
    fechaInicio: hoyStr,
    fechaFin: hoyStr,
  });
  const qsFecha =
    periodo.clave === "hoy"
      ? `fecha=${hoyStr}`
      : queryFechasCampo(periodo) || `fecha=${hoyStr}`;
  return (
    <div className="min-w-0 w-full px-4 py-3 sm:px-6 sm:py-5 lg:px-8">
      <RutaImpulsadorDelPeriodo
        key={qsFecha}
        qsFecha={qsFecha}
        periodo={periodo}
        onPeriodo={setPeriodo}
      />
    </div>
  );
}

function RutaImpulsadorDelPeriodo({
  qsFecha,
  periodo,
  onPeriodo,
}: {
  qsFecha: string;
  periodo: PeriodoFiltro;
  onPeriodo: (periodo: PeriodoFiltro) => void;
}) {
  const { usuario } = usePanel();
  const hoyStr = useFechaCampo();
  const lista = useJornadaCompleta<AgendaCampo>(qsFecha);
  const [visitaAbierta, setAbierta] = useState<VisitaCampo | null>(null);
  const abierta =
    visitaAbierta?.fecha.slice(0, 10) === hoyStr ? visitaAbierta : null;
  const [error, setError] = useState("");
  const [mapa, setMapa] = useState<LocalCampo | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<FiltroRuta>("todos");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(7);
  const [expandida, setExpandida] = useState<number | null | undefined>();
  const [revision, setRevision] = useState(0);

  // Modal para reportar novedad en un local
  const [novedadLocal, setNovedadLocal] = useState<Pick<
    LocalCampo,
    "id" | "nombre"
  > | null>(null);
  const [rutaCalc, setRutaCalc] = useState<{
    qs: string;
    origen: CoordenadaCampo;
    ids: number[];
    paradas: CoordenadaCampo[];
    aviso: string;
  } | null>(null);
  const [calculandoRuta, setCalculandoRuta] = useState(false);
  const [avisoRuta, setAvisoRuta] = useState("");
  const origenGps = rutaCalc?.qs === qsFecha ? rutaCalc.origen : null;
  const ordenRuta = rutaCalc?.qs === qsFecha ? rutaCalc.ids : null;
  const paradasMaps = rutaCalc?.qs === qsFecha ? rutaCalc.paradas : [];

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
  }, [hoyStr, revision]);

  const itemsOrdenados = useMemo(() => {
    const peso = new Map(ordenRuta?.map((id, i) => [id, i]) ?? []);
    return lista.items
      .map((a, i) => ({ a, i }))
      .sort(
        (x, y) =>
          ORDEN_RUTA[x.a.estado] - ORDEN_RUTA[y.a.estado] ||
          (x.a.estado === "pendiente"
            ? (peso.get(x.a.id) ?? 10_000) - (peso.get(y.a.id) ?? 10_000)
            : 0) ||
          x.i - y.i,
      )
      .map(({ a }) => a);
  }, [lista.items, ordenRuta]);

  const itemsFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const porEstado =
      filtro === "todos"
        ? itemsOrdenados
        : itemsOrdenados.filter((a) => a.estado === filtro);
    const base = q
      ? porEstado.filter(
          (a) =>
            a.local.nombre.toLowerCase().includes(q) ||
            a.local.id.toLowerCase().includes(q) ||
            a.local.direccion.toLowerCase().includes(q),
        )
      : porEstado;
    return base;
  }, [itemsOrdenados, busqueda, filtro]);

  const totalParadas = lista.total || lista.items.length;
  const visitadas = lista.items.filter((a) => a.estado === "completado").length;
  const enCurso = lista.items.filter((a) => a.estado === "en_curso").length;
  const incompletas = lista.items.filter(
    (a) => a.estado === "incompleto",
  ).length;
  const ausentes = lista.items.filter((a) => a.estado === "ausente").length;
  const pendientes = Math.max(
    0,
    totalParadas - visitadas - enCurso - incompletas - ausentes,
  );

  function ventanaDe(a: AgendaCampo) {
    const horarios = a.local.horarios;
    return horarios.length
      ? { entrada: horarios[0].entrada, salida: horarios[0].salida }
      : { entrada: "08:00", salida: "18:00" };
  }

  function pendientesParaRuta(items: AgendaCampo[]) {
    return items.flatMap((a) =>
      a.estado === "pendiente" &&
      abierta?.local.id !== a.local.id &&
      conUbicacion(a.local)
        ? [{ ...a, local: a.local }]
        : [],
    );
  }

  async function posicionGps(): Promise<CoordenadaCampo | null> {
    if (!navigator.geolocation) return null;
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({
            latitud: pos.coords.latitude,
            longitud: pos.coords.longitude,
          }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 30_000 },
      );
    });
  }

  async function calcularRuta() {
    if (calculandoRuta) return;
    setCalculandoRuta(true);
    setAvisoRuta("");
    try {
      const pendientes = pendientesParaRuta(lista.items);
      if (!pendientes.length) {
        setRutaCalc(null);
        setAvisoRuta(
          "No hay locales pendientes con ubicación para armar la ruta.",
        );
        return;
      }
      let origen = await posicionGps();
      let aviso = "Ruta sugerida según tu GPS, horarios y distancia.";
      if (!origen) {
        origen = {
          latitud: pendientes[0].local.latitud,
          longitud: pendientes[0].local.longitud,
        };
        aviso = "Sin GPS: ordenamos desde el primer local con horario.";
      }
      const orden = ordenarParadasPorRuta(
        origen,
        pendientes.map((a) => {
          const ventana = ventanaDe(a);
          return {
            id: a.id,
            latitud: a.local.latitud,
            longitud: a.local.longitud,
            entrada: ventana.entrada,
            salida: ventana.salida,
          };
        }),
      );
      setRutaCalc({
        qs: qsFecha,
        origen,
        ids: orden.map((p) => p.id),
        paradas: orden.map((p) => ({
          latitud: p.latitud,
          longitud: p.longitud,
        })),
        aviso,
      });
      setAvisoRuta(aviso);
    } catch (e) {
      setAvisoRuta(mensajeError(e, "No se pudo calcular la ruta."));
    } finally {
      setCalculandoRuta(false);
    }
  }

  function iniciarEnMaps() {
    if (!origenGps || !paradasMaps.length) {
      setAvisoRuta("Calculá la ruta antes de iniciar el recorrido.");
      return;
    }
    const url = urlGoogleMapsRuta(origenGps, paradasMaps);
    if (!url) {
      setAvisoRuta("No hay coordenadas para abrir Google Maps.");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  const hoy = new URLSearchParams(qsFecha).get("fecha") === hoyStr;
  const inicioPeriodo = hoy
    ? hoyStr
    : (periodo.fechaInicio ?? periodo.fecha ?? hoyStr);
  const finPeriodo = hoy
    ? hoyStr
    : (periodo.fechaFin ?? periodo.fecha ?? inicioPeriodo);
  const resumen = lista.cargando
    ? "Cargando tu ruta…"
    : hoy && totalParadas > 0 && visitadas === totalParadas
      ? `Completaste ${totalParadas === 1 ? "el local" : `los ${totalParadas} locales`} de tu ruta`
      : `${hoy ? "Hoy tenés" : periodo.etiqueta + ":"} ${totalParadas} ${totalParadas === 1 ? "local" : "locales"} en tu ruta`;
  const numeroParada = new Map(
    itemsOrdenados
      .filter((a) => a.estado === "pendiente")
      .map((a, i) => [a.id, i + 1]),
  );
  const idExpandida =
    expandida === undefined
      ? (itemsOrdenados.find(
          (a) => a.id === abierta?.asignacionId || a.estado === "en_curso",
        )?.id ?? null)
      : expandida;
  const totalPages = Math.ceil(itemsFiltrados.length / limit);
  const paginaActual = Math.min(page, Math.max(1, totalPages));
  const itemsPagina = itemsFiltrados.slice(
    (paginaActual - 1) * limit,
    paginaActual * limit,
  );
  // Se pagina la vista sobre la misma ruta completa que usa el cálculo por GPS.
  const listaVisible = {
    ...lista,
    datos: {
      items: itemsPagina,
      total: itemsFiltrados.length,
      page: paginaActual,
      limit,
      totalPages,
    },
    items: itemsPagina,
    setPage,
    setLimit: (valor: number) => {
      setLimit(valor);
      setPage(1);
    },
  };
  const rutaActual = rutaCalc?.qs === qsFecha ? rutaCalc : null;
  const btnAccion =
    "inline-flex min-h-11 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-control-line bg-surface-raised px-3 text-xs font-semibold text-foreground transition-colors hover:border-brand-500 hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus";

  return (
    <>
      <SaludoRuta
        nombre={usuario.nombre.trim().split(/\s+/)[0] ?? ""}
        fechaTexto={textoRangoFechas(inicioPeriodo, finPeriodo)}
        resumen={resumen}
      >
        <SelectorFechaFiltro valorActual={periodo} onChange={onPeriodo} />
      </SaludoRuta>

      <div className="mb-2 mt-2 sm:mb-3 sm:mt-3">
        <KpisRuta
          total={lista.cargando ? "—" : totalParadas}
          visitadas={visitadas}
          enCurso={enCurso}
          pendientes={pendientes}
          sufijo={hoy ? "hoy" : "en el período"}
          filtro={filtro}
          onFiltro={(valor) => {
            setFiltro(valor);
            setPage(1);
          }}
        />
      </div>

      {abierta ? (
        <div className="mb-2 flex min-w-0 items-center gap-2 rounded-lg border border-sky-500 bg-sky-50/60 px-3 py-1 sm:mb-3 dark:border-sky-700 dark:bg-sky-950/40">
          <span
            aria-hidden="true"
            className="h-2 w-2 shrink-0 rounded-full bg-sky-600 dark:bg-sky-400"
          />
          <div className="min-w-0 flex-1">
            <p
              className="truncate text-xs font-semibold text-foreground"
              title={`Visita en curso · ${abierta.local.nombre}`}
            >
              En curso · {abierta.local.nombre}
            </p>
            <p className="truncate font-mono text-[11px] text-muted">
              Entrada: {formatoFechaHora(abierta.entrada)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setNovedadLocal(abierta.local)}
            className={btnAccion}
            aria-label={`Reportar novedad en ${abierta.local.nombre}`}
          >
            <IconoMensaje className="h-4 w-4" /> Novedad
          </button>
        </div>
      ) : null}

      <div className="mb-2 flex min-w-0 w-full items-center gap-2 sm:mb-3">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">
            Buscar local o cliente en toda la ruta
          </span>
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="search"
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setPage(1);
            }}
            placeholder="Buscar local o cliente…"
            className={`h-11 min-h-11 w-full rounded-lg border border-line bg-surface-raised py-2 pl-9 ${busqueda ? "pr-11" : "pr-3"} text-base text-foreground outline-none transition-colors placeholder:text-muted focus-visible:border-brand-600 focus-visible:ring-2 focus-visible:ring-brand-600/30 sm:text-sm`}
          />
          {busqueda ? (
            <button
              type="button"
              onClick={() => {
                setBusqueda("");
                setPage(1);
              }}
              aria-label="Limpiar búsqueda de locales"
              title="Limpiar búsqueda"
              className="absolute inset-y-0 right-0 grid min-w-11 cursor-pointer place-items-center rounded-r-lg text-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              <IconoCruz className="h-4 w-4" />
            </button>
          ) : null}
        </label>
        <button
          type="button"
          onClick={() => {
            lista.refrescar();
            setRevision((n) => n + 1);
          }}
          disabled={lista.cargando}
          aria-label="Actualizar ruta"
          title="Actualizar ruta"
          className={`${btnAccion} disabled:cursor-not-allowed disabled:opacity-50`}
        >
          <IconoRefrescar className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-2 flex min-h-11 min-w-0 items-center justify-between gap-2 px-0.5">
        <h2 className="flex min-w-0 items-center gap-1.5 text-[13px] font-bold text-foreground sm:text-sm">
          <IconoCalendario className="h-4 w-4 shrink-0 text-brand-700 dark:text-brand-200" />
          <span className="truncate">
            {hoy ? "Agenda del día" : `Agenda · ${periodo.etiqueta}`}
            {filtro !== "todos" ? ` · ${ETIQUETA_FILTRO[filtro]}` : ""}
          </span>
        </h2>
        {!rutaActual ? (
          <button
            type="button"
            onClick={() => void calcularRuta()}
            disabled={calculandoRuta || lista.cargando}
            className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-brand-200 bg-brand-50 px-3 text-xs font-semibold text-brand-800 transition-colors hover:border-brand-500 hover:bg-brand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50 dark:border-brand-800 dark:bg-brand-950/50 dark:text-brand-100 dark:hover:border-brand-500 dark:hover:bg-brand-900"
          >
            <IconoRuta className="h-4 w-4" /> Calcular ruta
          </button>
        ) : null}
      </div>

      {rutaActual ? (
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
                Ruta sugerida · {rutaActual.ids.length}{" "}
                {rutaActual.ids.length === 1 ? "parada" : "paradas"} ·{" "}
                {formatoDistancia(
                  metrosRecorrido(rutaActual.origen, rutaActual.paradas),
                )}{" "}
                aprox.
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-muted sm:text-xs">
                {avisoRuta || rutaActual.aviso} Es una recomendación: podés ir
                en el orden que prefieras.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setRutaCalc(null);
                setAvisoRuta("");
              }}
              aria-label="Quitar ruta sugerida"
              title="Quitar ruta sugerida"
              className="-mr-1.5 -mt-1.5 grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-lg text-muted transition-colors hover:bg-brand-100 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus dark:hover:bg-brand-900"
            >
              <IconoCruz className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-2.5 flex gap-2">
            <button
              type="button"
              onClick={iniciarEnMaps}
              disabled={!paradasMaps.length}
              className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-brand-700 px-3 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50 dark:bg-brand-500 dark:text-brand-950 dark:hover:brightness-110 sm:text-sm"
            >
              <IconoMapa className="h-4 w-4" /> Iniciar en Maps
            </button>
            <button
              type="button"
              onClick={() => void calcularRuta()}
              disabled={calculandoRuta}
              className={`${btnAccion} min-w-0 flex-1 justify-center disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <IconoRefrescar className="h-4 w-4" /> Recalcular
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
        lista={listaVisible}
        etiqueta="Agenda"
        columnas={[
          {
            titulo: "Local",
            valor: (a) => (
              <div className="min-w-0">
                <strong className="block font-semibold text-foreground">
                  {a.local.nombre}
                </strong>
                <p className="text-xs font-medium text-brand-700 dark:text-brand-200">
                  {a.local.direccion || a.local.id}
                </p>
              </div>
            ),
          },
          {
            titulo: "Visita",
            valor: (a) => {
              const ultima = a.visitas.at(-1);
              return (
                <div className="space-y-0.5 text-xs">
                  <p className="font-semibold text-foreground">
                    {ultima
                      ? `Entrada ${formatoFechaHora(ultima.entrada)}`
                      : "Sin visita todavía"}
                  </p>
                  {ultima?.salida ? (
                    <p className="text-muted">
                      Salida {formatoHora(ultima.salida)}
                    </p>
                  ) : ultima?.estado === "INCOMPLETA" ? (
                    <p className="text-amber-700 dark:text-amber-300">
                      Salida — · sin finalizar
                    </p>
                  ) : null}
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
                      className="rounded bg-surface-soft px-2 py-0.5"
                    >
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
            valor: (a) => <EstadoRutaSimple estado={a.estado} />,
          },
        ]}
        tarjetaMovil={(a) => (
          <TarjetaAgendaRepositor
            soloConsulta
            agenda={a}
            orden={numeroParada.get(a.id) ?? 0}
            distancia={
              origenGps && conUbicacion(a.local)
                ? formatoDistancia(metrosEntre(origenGps, a.local))
                : undefined
            }
            abierta={idExpandida === a.id}
            alternar={() => setExpandida(idExpandida === a.id ? null : a.id)}
            qsFecha={qsFecha}
            visitaAbierta={abierta}
            onMapa={() => setMapa(a.local)}
            onNovedad={() => setNovedadLocal(a.local)}
          />
        )}
        acciones={(a) => (
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setMapa(a.local)}
              className={btnAccion}
              aria-label={`Ver mapa de ${a.local.nombre}`}
            >
              <IconoMapa className="h-4 w-4" /> Mapa
            </button>
            <button
              type="button"
              onClick={() => setNovedadLocal(a.local)}
              className={btnAccion}
              aria-label={`Reportar novedad en ${a.local.nombre}`}
            >
              <IconoMensaje className="h-4 w-4" /> Novedad
            </button>
          </div>
        )}
      />
      {error ? (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
        >
          {error}
        </p>
      ) : null}
      <PantallaCarga
        visible={calculandoRuta}
        mensaje="Calculando mejor ruta"
        detalle="Usamos tu GPS, los horarios y la distancia entre locales."
      />
      {mapa ? <MapaLocal local={mapa} cerrar={() => setMapa(null)} /> : null}
      {novedadLocal ? (
        <ModalNovedadLocal
          local={novedadLocal}
          visitaId={
            abierta?.local.id === novedadLocal.id ? abierta.id : undefined
          }
          cerrar={() => setNovedadLocal(null)}
        />
      ) : null}
    </>
  );
}
