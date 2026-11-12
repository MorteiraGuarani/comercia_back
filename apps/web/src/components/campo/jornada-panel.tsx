"use client";
import type { PeriodoFiltro } from "@/types/periodo-filtro";
import dynamic from "next/dynamic";
import { EstadoTelefono } from "./estado-telefono";
import {
  ETIQUETA_FILTRO,
  ORDEN_RUTA,
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
import { formatoDuracionMinutos } from "@/utils/duracion";
import {
  metrosRecorrido,
  ordenarParadasPorRuta,
  urlGoogleMapsRuta,
  type CoordenadaCampo,
  conUbicacion,
} from "@/utils/ruta-recomendada";
import { mensajeError } from "@/utils/error";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ApiError, apiFetch } from "@/lib/api";
import { visitasAbiertas } from "@/lib/visitas-abiertas";
import type { RespuestaPaginada } from "@/types/paginacion";
import { obtenerPosicionPrecisa } from "@/lib/gps-preciso";
import {
  EVENTO_MARCAS_SIN_CONEXION,
  descartarMarcaRechazada,
  esSinConexion,
  guardarMarcaSinConexion,
  leerMarcasRechazadas,
  leerMarcasSinConexion,
} from "@/lib/marcas-sin-conexion";
import { visitaSinConexion } from "@/utils/visita-sin-conexion";
import { enviarMarcasYAvisar } from "./sincronizador-marcas";
import { mostrarToast } from "@/components/toast/toast-controller";
import { notificarJornadaMarcada } from "@/lib/eventos-plataforma";
import { usePanel } from "@/components/panel/contexto";
import { useListaCampo } from "@/hooks/use-lista-campo";
import { useFechaCampo } from "@/hooks/use-fecha-campo";
import {
  formatoFechaHora,
  formatoHora,
  queryFechasCampo,
  textoRangoFechas,
} from "@/utils/fechas";
import { SelectorFechaFiltro } from "./ui/selector-fecha-filtro";
import { PantallaCarga } from "@/components/pantalla-carga";
import { btnFinalizar, btnGhost, btnPrimary, errorBox } from "@/components/ui";

// Acciones secundarias de la tabla: compactas, con ícono y en una fila.
const btnAccion =
  "inline-flex min-h-11 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-control-line bg-surface-raised px-3 text-xs font-semibold text-foreground transition hover:border-brand-500 hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-control-line disabled:hover:bg-surface-raised";
import { TablaCampo } from "./tabla-campo";
import type {
  AgendaCampo,
  LocalCampo,
  MarcaSinConexion,
  VisitaCampo,
} from "@/types/campo";
import { TareasDeLocal } from "./tareas-de-local";
import { InventarioLocalModal } from "./inventario-local-modal";

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
  const { usuario, modulos } = usePanel();
  const hoyStr = useFechaCampo();
  // El buscador filtra en el servidor: encuentra locales de cualquier página.
  const [busqueda, setBusqueda] = useState("");
  const [buscar, setBuscar] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setBuscar(busqueda.trim()), 300);
    return () => clearTimeout(t);
  }, [busqueda]);
  const lista = useListaCampo<AgendaCampo>(
    `/campo/jornada?${qsFecha}${buscar ? `&buscar=${encodeURIComponent(buscar)}` : ""}`,
  );
  const [expandida, setExpandida] = useState<number | null | undefined>();
  // Puede tener varias visitas abiertas: entró a otro local sin cerrar el anterior.
  const [visitasAbiertasHoy, setAbiertas] = useState<VisitaCampo[]>([]);
  const abiertas = visitasAbiertasHoy.filter((v) => v.fecha.slice(0, 10) === hoyStr);
  // Marcas guardadas en este navegador sin conexión con Ucheck (se mandan solas).
  const [versionCola, setVersionCola] = useState(0);
  useEffect(() => {
    const leer = () => setVersionCola((n) => n + 1);
    void Promise.resolve().then(leer);
    window.addEventListener(EVENTO_MARCAS_SIN_CONEXION, leer);
    return () => window.removeEventListener(EVENTO_MARCAS_SIN_CONEXION, leer);
  }, []);
  const cola = useMemo(
    () => (versionCola ? leerMarcasSinConexion(usuario.id) : []),
    [usuario.id, versionCola],
  );
  // Rechazadas al enviarlas: el aviso queda hasta que tocan "Entendido".
  const rechazadas = useMemo(
    () => (versionCola ? leerMarcasRechazadas(usuario.id) : []),
    [usuario.id, versionCola],
  );
  const colaHoy = cola.filter((m) => m.fecha === hoyStr);
  const salidaEnCola = (v: { asignacionId: number; horarioId: number | null }) =>
    colaHoy.some(
      (m) => m.tipo === "SALIDA" && m.asignacionId === v.asignacionId && m.horarioId === v.horarioId,
    );
  // Las visitas en curso que se ven: las de Comercia, salvo que su salida esté
  // guardada en este equipo, y las entradas guardadas sin conexión.
  const abiertasVista = [
    ...colaHoy
      .filter(
        (m) =>
          m.tipo === "ENTRADA" &&
          !salidaEnCola(m) &&
          !abiertas.some(
            (v) => v.asignacionId === m.asignacionId && v.horarioId === m.horarioId,
          ),
      )
      .map((m) => visitaSinConexion(m, usuario)),
    ...abiertas.filter((v) => !salidaEnCola(v)),
  ];
  const abiertaDe = (asignacionId: number) =>
    abiertasVista.find((v) => v.asignacionId === asignacionId) ?? null;
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const [mapa, setMapa] = useState<LocalCampo | null>(null);
  const [tareas, setTareas] = useState<AgendaCampo | null>(null);
  // Desde Inicio ("Ver" tareas) se llega con ?tareas=<asignación> y se abre ese modal.
  const pedidoTareas = Number(useSearchParams().get("tareas")) || null;
  const tareasDe =
    tareas ?? lista.items.find((a) => pedidoTareas !== null && a.id === pedidoTareas) ?? null;
  const [novedadDe, setNovedadDe] = useState<AgendaCampo | null>(null);
  // El inventario se abre acá mismo: sin ir a otra página ni recargar Mi Ruta.
  const [inventarioDe, setInventarioDe] = useState<string | null>(null);
  // Sube al cerrar el modal de tareas para refrescar el "2/5" de la tarjeta.
  const [revisionTareas, setRevisionTareas] = useState(0);
  const [filtro, setFiltro] = useState<FiltroRuta>("todos");
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
    visitasAbiertas()
      .then((v) => {
        if (vigente) setAbiertas(v);
      })
      .catch((e: Error) => {
        if (vigente) setError(e.message);
      });
    return () => {
      vigente = false;
    };
  }, [revision, hoyStr]);

  // Marcas que Ucheck guardó y cuya copia todavía no llegó a Comercia.
  const [pendientesSync, setPendientesSync] = useState(0);
  const [reintentando, setReintentando] = useState(false);
  useEffect(() => {
    let vigente = true;
    apiFetch<RespuestaPaginada<unknown>>("/campo/jornada/operaciones-pendientes?limit=1")
      .then((r) => {
        if (vigente) setPendientesSync(r.total);
      })
      .catch(() => undefined);
    return () => {
      vigente = false;
    };
  }, [revision]);

  function actualizar() {
    lista.refrescar();
    setRevision((n) => n + 1);
  }
  // Mientras haya pendientes, la ruta se refresca sola: Comercia las trae cada 15 s.
  const { refrescar } = lista;
  const haySync = pendientesSync > 0;
  useEffect(() => {
    if (!haySync) return;
    const t = setInterval(() => {
      refrescar();
      setRevision((n) => n + 1);
    }, 20_000);
    return () => clearInterval(t);
  }, [haySync, refrescar]);
  async function reintentarSync() {
    setReintentando(true);
    try {
      const { pendientes } = await apiFetch<{ pendientes: number }>(
        "/campo/jornada/operaciones-pendientes/reintentar",
        { method: "POST" },
      );
      if (pendientes)
        mostrarToast(
          "alerta",
          `${pendientes === 1 ? "La marca sigue" : `Siguen ${pendientes} marcas`} sin llegar a Comercia. Ya están guardadas en Ucheck: se reintenta sola. Si no se resuelve, avisá a soporte.`,
          "Sincronización pendiente",
        );
      else mostrarToast("exito", "Las marcas guardadas en Ucheck ya llegaron a Comercia.", "Sincronizado");
    } catch (e) {
      mostrarToast("error", mensajeError(e, "No se pudo reintentar la sincronización."), "Sin sincronizar");
    } finally {
      setReintentando(false);
      actualizar();
    }
  }
  // Cuando se mandan marcas guardadas, la ruta trae las visitas de Comercia.
  const [enviandoCola, setEnviandoCola] = useState(false);
  const largoCola = useRef(0);
  useEffect(() => {
    if (cola.length < largoCola.current) actualizar();
    largoCola.current = cola.length;
  });

  // Iniciar y Finalizar Visita no abren formulario y el resultado llega en un
  // toast. Primero Ucheck toma la ubicación del teléfono en ese momento; si el
  // teléfono no responde, va el GPS del navegador; y sin conexión con Ucheck la
  // marca queda guardada en este navegador y se manda sola al volver.
  const [marcando, setMarcando] = useState<{
    nombre: string;
    entrada: boolean;
    paso: string;
  } | null>(null);
  async function marcarVisita(m: {
    asignacionId: number;
    horarioId: number | null;
    fecha: string;
    visitaId?: number;
    local: MarcaSinConexion["local"];
  }) {
    if (marcando) return;
    const entrada = !m.visitaId;
    const accion = entrada ? "iniciar" : "finalizar";
    const titulo = entrada ? "Visita iniciada" : "Visita finalizada";
    const paso = (texto: string) =>
      setMarcando({ nombre: m.local.nombre, entrada, paso: texto });
    const marcar = (ubicacion?: MarcaSinConexion["ubicacion"]) =>
      apiFetch<{ estado?: "CONFIRMADA" | "PENDIENTE"; mensaje?: string }>(
        entrada
          ? "/campo/jornada/repositor/entrada"
          : `/campo/jornada/repositor/visitas/${m.visitaId}/salida`,
        {
          method: "POST",
          body: JSON.stringify({
            nota: "",
            ...(entrada
              ? { asignacionId: m.asignacionId, horarioId: m.horarioId ?? undefined }
              : {}),
            ...(ubicacion ? { ubicacion } : {}),
          }),
        },
      );
    const gpsNavegador = async () => {
      paso("Tomando la ubicación de este equipo");
      const p = await obtenerPosicionPrecisa({ objetivoMetros: 15, maxMs: 10_000 });
      return {
        latitud: p.coords.latitude,
        longitud: p.coords.longitude,
        precisionMetros: p.coords.accuracy,
        capturadaEn: new Date(p.timestamp).toISOString(),
      };
    };
    const guardarEnEsteEquipo = async (ubicacion?: MarcaSinConexion["ubicacion"]) => {
      const gps = ubicacion ?? (await gpsNavegador());
      guardarMarcaSinConexion(usuario.id, {
        id: crypto.randomUUID(),
        tipo: entrada ? "ENTRADA" : "SALIDA",
        asignacionId: m.asignacionId,
        horarioId: m.horarioId,
        fecha: m.fecha,
        tomadaEn: new Date().toISOString(),
        ubicacion: gps,
        nota: "",
        local: m.local,
      });
      mostrarToast(
        "alerta",
        `Sin conexión con Ucheck: la ${entrada ? "entrada" : "salida"} de ${m.local.nombre} quedó guardada en este equipo y se envía sola cuando vuelva la conexión. No borres los datos del navegador hasta que se envíe.`,
        titulo,
      );
    };
    try {
      // La entrada todavía está en este equipo: la salida va detrás de ella.
      if (m.visitaId !== undefined && m.visitaId < 0) return await guardarEnEsteEquipo();
      paso("Pidiendo la ubicación al teléfono en Ucheck");
      let r: Awaited<ReturnType<typeof marcar>>;
      try {
        r = await marcar();
      } catch (e) {
        if (esSinConexion(e)) return await guardarEnEsteEquipo();
        // Sin la ubicación del teléfono no se marca con la del navegador: tiene que abrir Ucheck.
        if (e instanceof ApiError && e.codigo === "TELEFONO_SIN_UBICACION")
          throw new ApiError(
            e.status,
            "Ucheck no tiene la ubicación de tu teléfono. Abrí la aplicación Ucheck, iniciala y volvé a marcar.",
            e.codigo,
          );
        throw e;
      }
      if (r.estado === "PENDIENTE")
        mostrarToast(
          "alerta",
          r.mensaje ??
            `${entrada ? "Entrada" : "Salida"} guardada en Ucheck, pendiente de sincronización.`,
          titulo,
        );
      else
        mostrarToast(
          "exito",
          `${entrada ? "Iniciaste" : "Finalizaste"} la visita a ${m.local.nombre}.`,
          titulo,
        );
      actualizar();
      if (entrada) notificarJornadaMarcada();
    } catch (e) {
      // 4xx: falta algo de tu lado (tareas, teléfono, radio); lo demás es un error.
      const aviso = e instanceof ApiError && e.status >= 400 && e.status < 500;
      mostrarToast(
        aviso ? "alerta" : "error",
        mensajeError(e, `No se pudo ${accion} la visita.`),
        `No se ${entrada ? "inició" : "finalizó"} la visita`,
      );
    } finally {
      setMarcando(null);
    }
  }
  const finalizarVisita = (v: VisitaCampo) =>
    marcarVisita({
      asignacionId: v.asignacionId,
      horarioId: v.horarioId,
      fecha: v.fecha.slice(0, 10),
      visitaId: v.id,
      local: v.local,
    });
  const localDe = (a: AgendaCampo) => ({
    id: a.local.id,
    nombre: a.local.nombre,
    radioMetros: a.local.radioMetros,
  });

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
        (a) => a.id === abiertasVista[0]?.asignacionId,
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
    return porEstado;
  }, [itemsOrdenados, filtro]);

  // Se abre sola la tarjeta en curso hasta que el usuario elige otra.
  const idExpandida =
    expandida === undefined
      ? (abiertasVista.find((v) => itemsOrdenados.some((a) => a.id === v.asignacionId))
          ?.asignacionId ??
        itemsOrdenados.find((a) => a.estado === "en_curso")?.id ??
        null)
      : expandida;

  const paginasJornada =
    modulos.find((m) => m.ruta === "mi-jornada")?.paginas ?? [];
  const conInventario = paginasJornada.some((p) => p.ruta === "inventario");

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
          sufijo={hoy ? "hoy" : "en el período"}
          porPagina={porPagina}
          filtro={filtro}
          onFiltro={setFiltro}
        />
      </div>

      {cola.length ? (
        <div
          role="status"
          className="mb-3 flex min-w-0 flex-wrap items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
        >
          <p className="min-w-0 flex-1">
            {cola.length === 1 ? "1 marca guardada" : `${cola.length} marcas guardadas`} en
            este equipo sin conexión con Ucheck. Se envían solas cuando vuelve la conexión.
          </p>
          <button
            type="button"
            className={btnGhost}
            disabled={enviandoCola}
            onClick={() => {
              setEnviandoCola(true);
              void enviarMarcasYAvisar(usuario.id)
                .then(({ enviadas, rechazadas }) => {
                  if (!enviadas.length && !rechazadas.length)
                    mostrarToast(
                      "alerta",
                      "Todavía no hay conexión con Ucheck. Se vuelve a intentar sola cada minuto.",
                      "Marcas sin enviar",
                    );
                })
                .catch(() => undefined)
                .finally(() => setEnviandoCola(false));
            }}
          >
            Enviar ahora
          </button>
        </div>
      ) : null}

      {rechazadas.length ? (
        <div
          role="alert"
          className="mb-3 min-w-0 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-100"
        >
          <p className="font-semibold">
            {rechazadas.length === 1
              ? "1 marca guardada sin conexión no se registró"
              : `${rechazadas.length} marcas guardadas sin conexión no se registraron`}
          </p>
          <ul className="mt-2 space-y-2">
            {rechazadas.map(({ marca: m, motivo }) => {
              const tipo = m.tipo === "ENTRADA" ? "Entrada" : "Salida";
              return (
                <li key={m.id} className="flex min-w-0 flex-wrap items-center gap-2">
                  <p className="min-w-0 flex-1 break-words">
                    {tipo} de {m.local.nombre} ·{" "}
                    {m.fecha === hoyStr ? formatoHora(m.tomadaEn) : formatoFechaHora(m.tomadaEn)}:{" "}
                    {motivo}
                  </p>
                  <button
                    type="button"
                    className={`${btnGhost} whitespace-nowrap`}
                    aria-label={`Entendido: ${tipo.toLowerCase()} de ${m.local.nombre}`}
                    onClick={() => descartarMarcaRechazada(usuario.id, m.id)}
                  >
                    Entendido
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {pendientesSync ? (
        <div
          role="status"
          className="mb-3 flex min-w-0 flex-wrap items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
        >
          <p className="min-w-0 flex-1">
            {pendientesSync === 1 ? "1 marca guardada" : `${pendientesSync} marcas guardadas`} en
            Ucheck, pendiente de sincronización con Comercia.
          </p>
          <button
            type="button"
            className={`${btnGhost} whitespace-nowrap`}
            disabled={reintentando}
            onClick={() => void reintentarSync()}
          >
            Reintentar
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
            onChange={(e) => {
              setBusqueda(e.target.value);
              lista.setPage(1);
            }}
            aria-label="Buscar local por nombre, código o dirección"
            name="buscar-local"
            autoComplete="off"
            placeholder="Buscar local, código o dirección…"
            className={`h-11 min-h-11 w-full rounded-lg border border-line bg-surface-raised py-2 pl-9 ${busqueda ? "pr-11" : "pr-3"} text-base text-foreground outline-none transition-colors placeholder:text-muted focus-visible:border-brand-600 focus-visible:ring-2 focus-visible:ring-brand-600/30 sm:text-sm dark:border-line dark:bg-surface-raised dark:text-foreground`}
          />
          {busqueda && (
            <button
              type="button"
              onClick={() => {
                setBusqueda("");
                lista.setPage(1);
              }}
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
                abiertaDe(a.id)?.entrada ??
                a.visitas.find((v) => v.estado === "EN_CURSO")?.entrada;
              const ultima = a.visitas.at(-1);
              const parada = numeroParada.get(a.id);
              return (
                <div className="min-w-0 space-y-0.5 text-xs">
                  <p className="font-semibold text-foreground">
                    {enCurso
                      ? `En el local desde ${formatoHora(enCurso)}`
                      : ultima
                        ? ultima.salida
                          ? `Presente ${formatoHora(ultima.entrada)}–${formatoHora(ultima.salida)} · ${formatoDuracionMinutos((Date.parse(ultima.salida) - Date.parse(ultima.entrada)) / 60_000)}`
                          : `Entrada ${formatoHora(ultima.entrada)} · salida — sin finalizar`
                        : ruta && parada && conUbicacion(a.local)
                          ? `Parada ${parada} · a ${formatoDistancia(metrosEntre(ruta.origen, a.local))}`
                          : "Sin visita todavía"}
                  </p>
                  {a.heredada ? (
                    <p className="text-muted">Local de {a.titular}</p>
                  ) : a.esBackup ? (
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
              return <StatusStamp tone={RUTA[a.estado].tone}>{RUTA[a.estado].etiqueta}</StatusStamp>;
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
            visitaAbierta={abiertaDe(a.id)}
            onInventario={conInventario ? () => setInventarioDe(a.local.id) : undefined}
            onEntrada={(horarioId) =>
              void marcarVisita({
                asignacionId: a.id,
                horarioId: horarioId ?? null,
                fecha: hoyStr,
                local: localDe(a),
              })
            }
            onSalida={(v) => void finalizarVisita(v)}
            onTareas={() => setTareas(a)}
            onMapa={() => setMapa(a.local)}
            onNovedad={() => setNovedadDe(a)}
          />
        )}
        acciones={(a) => {
          const aqui = abiertaDe(a.id);
          // Un solo "Marcar entrada": el del próximo horario sin visita. Una
          // visita abierta en otro local no lo impide.
          const proximo =
            hoy && !aqui
              ? (a.local.horarios.length ? a.local.horarios : [null]).find(
                  (h) =>
                    !a.visitas.some((v) => v.horarioId === (h?.id ?? null)),
                )
              : undefined;
          return (
            <div className="flex min-w-[17rem] flex-col items-start gap-2">
              {aqui ? (
                <button
                  className={btnFinalizar}
                  disabled={!!marcando}
                  onClick={() => void finalizarVisita(aqui)}
                >
                  Finalizar Visita
                </button>
              ) : proximo !== undefined ? (
                <button
                  className={btnPrimary}
                  disabled={!!marcando}
                  onClick={() =>
                    void marcarVisita({
                      asignacionId: a.id,
                      horarioId: proximo?.id ?? null,
                      fecha: hoyStr,
                      local: localDe(a),
                    })
                  }
                >
                  Iniciar Visita
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
                  title={aqui ? undefined : "Iniciá la visita para ver las tareas"}
                >
                  <IconoTareas className="h-4 w-4" />
                  Tareas
                </button>
                {conInventario ? (
                  <button
                    className={btnAccion}
                    onClick={() => setInventarioDe(a.local.id)}
                    disabled={!aqui}
                    title={aqui ? undefined : "Iniciá la visita para usar el inventario"}
                  >
                    <IconoCaja className="h-4 w-4" />
                    Inventario
                  </button>
                ) : null}
                <button
                  className={btnAccion}
                  onClick={() => setNovedadDe(a)}
                  disabled={!aqui}
                  title={aqui ? undefined : "Iniciá la visita para reportar una novedad"}
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
      <PantallaCarga visible={enviandoCola} mensaje="Enviando marcas guardadas a Ucheck" />
      <PantallaCarga visible={reintentando} mensaje="Sincronizando marcas con Ucheck" />
      <PantallaCarga
        visible={!!marcando}
        mensaje={marcando?.entrada ? "Iniciando visita" : "Finalizando visita"}
        detalle={`${marcando?.paso ?? ""} · ${marcando?.nombre ?? ""}`}
      />
      {mapa ? <MapaLocal local={mapa} cerrar={() => setMapa(null)} /> : null}
      {novedadDe ? (
        <ModalNovedadLocal
          local={novedadDe.local}
          visitaId={abiertas.find((v) => v.asignacionId === novedadDe.id)?.id}
          cerrar={() => setNovedadDe(null)}
        />
      ) : null}
      {inventarioDe ? (
        <InventarioLocalModal
          key={inventarioDe}
          localId={inventarioDe}
          textoCerrar="Volver a la visita"
          onCerrar={() => setInventarioDe(null)}
        />
      ) : null}
      {tareasDe ? (
        <TareasDeLocal
          agenda={tareasDe}
          qsFecha={qsFecha}
          abierta={abiertas.find((v) => v.asignacionId === tareasDe.id) ?? null}
          cerrar={() => {
            setTareas(null);
            // Sin el ?tareas= el modal no se vuelve a abrir solo.
            if (pedidoTareas) window.history.replaceState(null, "", window.location.pathname);
            setRevisionTareas((n) => n + 1);
          }}
        />
      ) : null}
    </>
  );
}
