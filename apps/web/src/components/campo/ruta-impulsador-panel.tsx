"use client";

import React, { useEffect, useState, useMemo } from "react";
import { apiFetch } from "@/lib/api";
import { useJornadaCompleta } from "@/hooks/use-jornada-completa";
import { fechaEnZonaIso, queryFechasCampo } from "@/utils/fechas";
import { formatoDistancia, metrosEntre } from "@/utils/distancia";
import {
  ordenarParadasPorRuta,
  urlGoogleMapsRuta,
  type CoordenadaCampo,
} from "@/utils/ruta-recomendada";
import { mensajeError } from "@/utils/error";
import { TOKENS } from "./tokens";
import { StatusStamp } from "./ui/status-stamp";
import { StatChip } from "./ui/stat-chip";
import { TopBar } from "./ui/top-bar";
import {
  SelectorFechaFiltro,
  type PeriodoFiltro,
} from "./ui/selector-fecha-filtro";
import { Modal } from "@/components/modal";
import { PantallaCarga } from "@/components/pantalla-carga";
import { MapaLocal } from "./mapa-local";
import { crearNovedadCampo } from "@/lib/api-adjuntos-campo";
import { SelectorFotosCampo } from "./selector-fotos-campo";
import type {
  AgendaCampo,
  LocalCampo,
  VisitaCampo,
  TipoNovedad,
} from "@/types/campo";

type LocalParaNovedad = Pick<LocalCampo, "id" | "nombre">;

export function RutaImpulsadorPanel() {
  const hoyStr = fechaEnZonaIso(new Date());
  const [periodo, setPeriodo] = useState<PeriodoFiltro>({
    clave: "hoy",
    etiqueta: "Hoy",
    fecha: hoyStr,
    fechaInicio: hoyStr,
    fechaFin: hoyStr,
  });
  const qsFecha = queryFechasCampo(periodo) || `fecha=${hoyStr}`;
  const lista = useJornadaCompleta<AgendaCampo>(qsFecha);
  const [abierta, setAbierta] = useState<VisitaCampo | null>(null);
  const [error, setError] = useState("");
  const [mapa, setMapa] = useState<LocalCampo | null>(null);
  const [busqueda, setBusqueda] = useState("");

  // Modal para reportar novedad en un local
  const [novedadLocal, setNovedadLocal] = useState<LocalParaNovedad | null>(
    null,
  );
  const [tipoNovedad, setTipoNovedad] = useState<TipoNovedad>("INCIDENCIA");
  const [tituloNovedad, setTituloNovedad] = useState("");
  const [descNovedad, setDescNovedad] = useState("");
  const [fotosNovedad, setFotosNovedad] = useState<File[]>([]);
  const [guardandoNovedad, setGuardandoNovedad] = useState(false);
  const [novedadExito, setNovedadExito] = useState(false);
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
  }, []);

  const itemsFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const base = q
      ? lista.items.filter(
          (a) =>
            a.local.nombre.toLowerCase().includes(q) ||
            a.local.cliente.nombre.toLowerCase().includes(q) ||
            a.local.direccion.toLowerCase().includes(q),
        )
      : lista.items;
    const visitado = (a: AgendaCampo) => a.visitas.some((v) => v.salida);
    if (!ordenRuta?.length) {
      return [...base].sort(
        (a, b) => Number(visitado(a)) - Number(visitado(b)),
      );
    }
    const peso = new Map(ordenRuta.map((id, i) => [id, i]));
    return [...base].sort((a, b) => {
      const va = visitado(a);
      const vb = visitado(b);
      if (va !== vb) return Number(va) - Number(vb);
      const pa = peso.get(a.id) ?? 10_000;
      const pb = peso.get(b.id) ?? 10_000;
      return pa - pb;
    });
  }, [lista.items, busqueda, ordenRuta]);

  const totalParadas = lista.total || lista.items.length;
  const visitadas = lista.items.filter((a) =>
    a.visitas.some((v) => v.salida),
  ).length;
  const enCurso = abierta ? 1 : 0;
  const pendientes = Math.max(0, totalParadas - visitadas - enCurso);

  function ventanaDe(a: AgendaCampo) {
    const horarios = a.local.horarios;
    return horarios.length
      ? { entrada: horarios[0].entrada, salida: horarios[0].salida }
      : { entrada: "08:00", salida: "18:00" };
  }

  function pendientesParaRuta(items: AgendaCampo[]) {
    return items.filter(
      (a) =>
        !a.visitas.some((v) => v.salida) &&
        abierta?.local.id !== a.local.id &&
        Number.isFinite(a.local.latitud) &&
        Number.isFinite(a.local.longitud),
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

  const enviarNovedad = async () => {
    if (
      !novedadLocal ||
      !tituloNovedad.trim() ||
      !descNovedad.trim() ||
      guardandoNovedad
    )
      return;
    try {
      setGuardandoNovedad(true);
      await crearNovedadCampo(
        {
          localId: novedadLocal.id,
          tipo: tipoNovedad,
          titulo: tituloNovedad.trim(),
          descripcion: descNovedad.trim(),
          visitaId:
            abierta?.local.id === novedadLocal.id ? abierta.id : undefined,
        },
        fotosNovedad,
      );
      setNovedadExito(true);
      setTimeout(() => {
        setNovedadLocal(null);
        setTituloNovedad("");
        setDescNovedad("");
        setFotosNovedad([]);
        setNovedadExito(false);
      }, 1400);
    } catch (e) {
      alert(
        "Error al reportar novedad: " + mensajeError(e, "Error inesperado"),
      );
    } finally {
      setGuardandoNovedad(false);
    }
  };

  return (
    <div
      className="campo-screen min-w-0 w-full min-h-[calc(100vh-5rem)] flex flex-col font-sans"
      style={{
        background: TOKENS.bone,
        color: TOKENS.ink,
      }}
    >
      <TopBar
        title="Mi Ruta"
        subtitle="Locales, horarios y avance de tu recorrido"
        right={
          <SelectorFechaFiltro valorActual={periodo} onChange={setPeriodo} />
        }
      />

      <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto w-full space-y-6 flex-1 overflow-y-auto">
        {/* StatChips estilo editorial */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 sm:grid sm:grid-cols-4 sm:overflow-visible">
          <div className="min-w-[8.25rem] flex-1">
            <StatChip label="Total paradas" value={totalParadas} tone="ink" />
          </div>
          <div className="min-w-[8.25rem] flex-1">
            <StatChip label="Visitadas" value={visitadas} tone="fresco" />
          </div>
          <div className="min-w-[8.25rem] flex-1">
            <StatChip label="En curso" value={enCurso} tone="frio" />
          </div>
          <div className="min-w-[8.25rem] flex-1">
            <StatChip label="Pendientes" value={pendientes} tone="sub" />
          </div>
        </div>

        {/* Visita en curso destacada */}
        {abierta && (
          <div
            className="rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm border-2"
            style={{
              background: TOKENS.canvas,
              borderColor: TOKENS.frio,
            }}
          >
            <div className="flex items-center gap-3">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-600"></span>
              </span>
              <div>
                <p
                  className="ft-body font-bold text-sm"
                  style={{ color: TOKENS.ink }}
                >
                  Visita en curso · {abierta.local.nombre}
                </p>
                <p className="ft-mono text-xs text-muted">
                  Entrada registrada:{" "}
                  {new Date(abierta.entrada).toLocaleTimeString("es-AR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setNovedadLocal(abierta.local)}
                aria-label="Reportar novedad"
                title="Reportar novedad"
                className="grid h-11 w-11 cursor-pointer place-items-center rounded-lg border border-accent-ink bg-accent-soft text-xl font-semibold text-accent-ink transition hover:bg-surface-soft"
              >
                <span aria-hidden="true">+</span>
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-row gap-2">
          <button
            type="button"
            onClick={() => void calcularRuta()}
            disabled={calculandoRuta || lista.cargando}
            className="h-11 min-h-11 flex-1 cursor-pointer rounded-lg border border-line bg-surface-raised px-3 text-xs font-bold text-foreground transition hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 disabled:cursor-not-allowed dark:border-line"
          >
            Calcular ruta
          </button>
          <button
            type="button"
            onClick={iniciarEnMaps}
            disabled={!paradasMaps.length}
            className="h-11 min-h-11 flex-1 cursor-pointer rounded-lg bg-[#1E2320] px-3 text-xs font-bold text-white transition hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 disabled:cursor-not-allowed dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            Iniciar en Maps
          </button>
        </div>
        {(rutaCalc?.qs === qsFecha ? rutaCalc.aviso : avisoRuta) ? (
          <p className="rounded-lg border border-line bg-surface-soft px-3 py-2 text-xs text-foreground dark:border-line">
            {rutaCalc?.qs === qsFecha ? rutaCalc.aviso : avisoRuta}
          </p>
        ) : null}

        {/* Buscador de locales */}
        <div className="relative">
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar local o cliente en la ruta..."
            className="w-full text-xs p-2.5 pl-8 rounded-lg outline-none bg-surface-raised border border-line"
          />
          <svg
            className="w-4 h-4 text-muted absolute left-2.5 top-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>

        {/* Lista de paradas de la ruta */}
        <div className="space-y-2.5 pb-16">
          {lista.cargando ? (
            <p className="py-8 text-center text-xs text-muted">
              Cargando tu ruta…
            </p>
          ) : itemsFiltrados.length === 0 ? (
            <div
              className="rounded-lg p-8 text-center"
              style={{
                background: TOKENS.canvas,
                border: `1px solid ${TOKENS.line}`,
              }}
            >
              <p className="ft-body text-xs text-muted">
                No hay locales programados en tu ruta para esta fecha.
              </p>
            </div>
          ) : (
            itemsFiltrados.map((a, i) => {
              const estaEnCurso = abierta?.local.id === a.local.id;
              const tieneVisitaCerrada = a.visitas.some((v) => v.salida);
              const ultimaVisita = a.visitas[a.visitas.length - 1];

              const estado = estaEnCurso
                ? "en_curso"
                : tieneVisitaCerrada
                  ? "completado"
                  : "pendiente";

              const tone =
                estado === "completado"
                  ? "fresco"
                  : estado === "en_curso"
                    ? "frio"
                    : "ink";
              const label =
                estado === "completado"
                  ? "VISITADO"
                  : estado === "en_curso"
                    ? "EN CURSO"
                    : "PENDIENTE";

              const horarios = a.local.horarios;
              const ventana = horarios.length
                ? `${horarios[0].entrada} – ${horarios[0].salida}`
                : "08:00 – 18:00";
              const ordenNumero = ordenRuta
                ? ordenRuta.indexOf(a.id)
                : itemsFiltrados
                    .filter((x) => !x.visitas.some((v) => v.salida))
                    .findIndex((x) => x.id === a.id);

              return (
                <div
                  key={a.id}
                  className="rounded-lg p-3.5 flex flex-col justify-between transition-all"
                  style={{
                    background: TOKENS.canvas,
                    border: `1px solid ${estaEnCurso ? TOKENS.frio : TOKENS.line}`,
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span className="ft-display text-xs font-bold w-6 h-6 rounded-full bg-zinc-200 text-foreground flex items-center justify-center shrink-0 mt-0.5 dark:bg-zinc-700 dark:text-zinc-100">
                        {tieneVisitaCerrada
                          ? "✓"
                          : ordenNumero >= 0
                            ? ordenNumero + 1
                            : i + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="ft-body font-bold text-sm truncate text-foreground">
                            {a.local.nombre}
                          </p>
                          <span className="ft-body text-[11px] text-muted truncate">
                            · {a.local.cliente.nombre}
                          </span>
                        </div>
                        <p className="ft-body text-xs text-muted truncate mt-0.5">
                          {a.local.direccion || "Sin dirección fijada"}
                        </p>
                      </div>
                    </div>

                    <StatusStamp tone={tone}>{label}</StatusStamp>
                  </div>

                  <div
                    className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-2.5"
                    style={{ borderTop: `1px solid ${TOKENS.line}` }}
                  >
                    <div className="flex items-center gap-3 text-[11px] text-muted">
                      <span className="ft-mono">{ventana}</span>
                      {ultimaVisita?.entrada && (
                        <span className="ft-mono font-medium text-foreground">
                          Entrada{" "}
                          {new Date(ultimaVisita.entrada).toLocaleTimeString(
                            "es-AR",
                            { hour: "2-digit", minute: "2-digit" },
                          )}
                        </span>
                      )}
                      {ultimaVisita?.salida && (
                        <span className="ft-mono font-medium text-foreground">
                          Salida{" "}
                          {new Date(ultimaVisita.salida).toLocaleTimeString(
                            "es-AR",
                            { hour: "2-digit", minute: "2-digit" },
                          )}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {origenGps && Number.isFinite(a.local.latitud) ? (
                        <span className="ft-mono text-[10px] text-muted">
                          {formatoDistancia(
                            metrosEntre(origenGps, {
                              latitud: a.local.latitud,
                              longitud: a.local.longitud,
                            }),
                          )}
                        </span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setMapa(a.local)}
                        className="grid h-11 w-11 min-h-11 min-w-11 shrink-0 place-items-center rounded-lg border border-line bg-surface-raised text-foreground transition hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 cursor-pointer dark:border-line"
                        aria-label={`Ver mapa de ${a.local.nombre}`}
                        title="Ver mapa"
                      >
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          aria-hidden
                        >
                          <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                          <line x1="8" y1="2" x2="8" y2="18" />
                          <line x1="16" y1="6" x2="16" y2="22" />
                        </svg>
                      </button>

                      <button
                        type="button"
                        onClick={() => setNovedadLocal(a.local)}
                        className="h-11 min-h-11 shrink-0 rounded-lg border border-line bg-surface-raised px-2.5 text-[11px] font-semibold text-foreground transition hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 cursor-pointer dark:border-line"
                        aria-label={`Reportar novedad en ${a.local.nombre}`}
                        title={`Reportar novedad en ${a.local.nombre}`}
                      >
                        Novedad
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
        {lista.error || error ? (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
          >
            {lista.error || error}
          </p>
        ) : null}
      </div>
      <PantallaCarga
        visible={calculandoRuta}
        mensaje="Calculando mejor ruta"
        detalle="Usamos tu GPS, los horarios y la distancia entre locales."
      />
      <PantallaCarga
        visible={guardandoNovedad}
        mensaje={
          fotosNovedad.length
            ? "Enviando novedad y subiendo fotos"
            : "Enviando novedad"
        }
      />

      {/* Modal de Mapa */}
      {mapa && (
        <MapaLocal
          local={{
            id: 0,
            nombre: mapa.nombre,
            direccion: mapa.nombre,
            latitud: mapa.latitud,
            longitud: mapa.longitud,
            radioMetros: mapa.radioMetros,
            zonaHoraria: "America/Asuncion",
            clienteId: 0,
            contacto: "",
            telefono: "",
            notas: "",
            activo: true,
            cliente: { id: 0, nombre: "" },
          }}
          cerrar={() => setMapa(null)}
        />
      )}

      {/* Modal Reportar Novedad */}
      {novedadLocal && (
        <Modal
          titulo={`Novedad · ${novedadLocal.nombre}`}
          abierto={!!novedadLocal}
          onCerrar={() => {
            if (!guardandoNovedad) {
              setNovedadLocal(null);
              setFotosNovedad([]);
            }
          }}
          ancho="md"
        >
          {novedadExito ? (
            <div className="py-6 text-center text-emerald-700 space-y-2">
              <svg
                className="w-12 h-12 mx-auto text-emerald-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <p className="ft-display text-xl font-bold">
                ¡Novedad enviada con éxito!
              </p>
              <p className="ft-body text-xs text-muted">
                Tu Team Leader ya fue notificado.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="ft-body text-xs text-muted">
                Si ocurrió un imprevisto en este local (local cerrado, faltante
                de stock, reclamo de precio, etc.), reportalo para que tu
                supervisor intervenga.
              </p>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Tipo de Novedad:
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {(
                    ["INCIDENCIA", "RECLAMO", "CONSULTA", "SUGERENCIA"] as const
                  ).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTipoNovedad(t)}
                      className={`py-1.5 px-2 rounded-md text-xs font-semibold border transition cursor-pointer ${
                        tipoNovedad === t
                          ? "bg-zinc-900 text-white border-zinc-900"
                          : "bg-surface-raised text-foreground border-line"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Asunto / Título:
                </label>
                <input
                  type="text"
                  value={tituloNovedad}
                  onChange={(e) => setTituloNovedad(e.target.value)}
                  placeholder="Ej: Local cerrado por inventario"
                  className="w-full text-xs p-2.5 rounded-lg border border-line bg-surface-raised outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Descripción detallada:
                </label>
                <textarea
                  value={descNovedad}
                  onChange={(e) => setDescNovedad(e.target.value)}
                  rows={3}
                  placeholder="Detallá lo sucedido con la mayor precisión posible..."
                  className="w-full text-xs p-2.5 rounded-lg border border-line bg-surface-raised outline-none"
                />
              </div>

              <SelectorFotosCampo
                archivos={fotosNovedad}
                onChange={setFotosNovedad}
                disabled={guardandoNovedad}
              />

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setNovedadLocal(null);
                    setFotosNovedad([]);
                  }}
                  className="flex-1 py-2 text-xs font-semibold border rounded-lg text-foreground"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={enviarNovedad}
                  disabled={
                    !tituloNovedad.trim() ||
                    !descNovedad.trim() ||
                    guardandoNovedad
                  }
                  className="flex-1 py-2 text-xs font-bold bg-[#1E2320] text-white rounded-lg hover:bg-black transition disabled:opacity-50 cursor-pointer"
                >
                  {guardandoNovedad ? "Enviando..." : "Reportar Novedad"}
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
