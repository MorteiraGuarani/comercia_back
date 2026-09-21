"use client";

import React, { useEffect, useState, useMemo } from "react";
import { apiFetch } from "@/lib/api";
import { useListaCampo, useOperacionCampo } from "@/hooks/use-lista-campo";
import { Paginacion } from "@/components/paginacion";
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
import { SelectorFechaFiltro, type PeriodoFiltro } from "./ui/selector-fecha-filtro";
import { Modal } from "@/components/modal";
import { PantallaCarga } from "@/components/pantalla-carga";
import { MapaLocal } from "./mapa-local";
import type {
  AgendaCampo,
  LocalCampo,
  MarcaCampo,
  VisitaCampo,
  FormNovedadCampo,
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
  const lista = useListaCampo<AgendaCampo>(`/campo/jornada?${qsFecha}`, 0, 7);
  const [abierta, setAbierta] = useState<VisitaCampo | null>(null);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const [mapa, setMapa] = useState<LocalCampo | null>(null);
  const [busqueda, setBusqueda] = useState("");

  // Marca de entrada / salida
  const [marca, setMarca] = useState<{
    asignacionId: number;
    horarioId?: number;
    visitaId?: number;
    nombre: string;
  } | null>(null);

  // Modal para reportar novedad en un local
  const [novedadLocal, setNovedadLocal] = useState<LocalParaNovedad | null>(null);
  const [tipoNovedad, setTipoNovedad] = useState<TipoNovedad>("INCIDENCIA");
  const [tituloNovedad, setTituloNovedad] = useState("");
  const [descNovedad, setDescNovedad] = useState("");
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

  const op = useOperacionCampo();

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
  }, [revision]);

  function actualizar() {
    lista.refrescar();
    setRevision((n) => n + 1);
  }

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
    if (!ordenRuta?.length) return base;
    const peso = new Map(ordenRuta.map((id, i) => [id, i]));
    return [...base].sort((a, b) => {
      const pa = peso.get(a.id) ?? 10_000;
      const pb = peso.get(b.id) ?? 10_000;
      return pa - pb;
    });
  }, [lista.items, busqueda, ordenRuta]);

  const totalParadas = lista.items.length;
  const visitadas = lista.items.filter((a) => a.visitas.some((v) => v.salida)).length;
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
      const todas = await apiFetch<{ items: AgendaCampo[] }>(
        `/campo/jornada?${qsFecha}&page=1&limit=50`,
      );
      const pendientes = pendientesParaRuta(todas.items);
      if (!pendientes.length) {
        setRutaCalc(null);
        setAvisoRuta("No hay locales pendientes con ubicación para armar la ruta.");
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
        paradas: orden.map((p) => ({ latitud: p.latitud, longitud: p.longitud })),
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
    if (!novedadLocal || !tituloNovedad.trim() || !descNovedad.trim() || guardandoNovedad) return;
    try {
      setGuardandoNovedad(true);
      await apiFetch("/campo/novedades", {
        method: "POST",
        body: JSON.stringify({
          localId: novedadLocal.id,
          tipo: tipoNovedad,
          titulo: tituloNovedad.trim(),
          descripcion: descNovedad.trim(),
          visitaId: abierta?.local.id === novedadLocal.id ? abierta.id : undefined,
        }),
      });
      setNovedadExito(true);
      setTimeout(() => {
        setNovedadLocal(null);
        setTituloNovedad("");
        setDescNovedad("");
        setNovedadExito(false);
      }, 1400);
    } catch (e) {
      alert("Error al reportar novedad: " + mensajeError(e, "Error inesperado"));
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
        subtitle="Locales que tenés que visitar hoy y registro de entrada y salida"
        right={
          <SelectorFechaFiltro valorActual={periodo} onChange={setPeriodo} />
        }
      />

      <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto w-full space-y-6 flex-1 overflow-y-auto">
        {/* StatChips estilo editorial */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 sm:grid sm:grid-cols-4 sm:overflow-visible">
          <div className="min-w-[8.25rem] flex-1"><StatChip label="Total paradas" value={totalParadas} tone="ink" /></div>
          <div className="min-w-[8.25rem] flex-1"><StatChip label="Visitadas" value={visitadas} tone="fresco" /></div>
          <div className="min-w-[8.25rem] flex-1"><StatChip label="En curso" value={enCurso} tone="frio" /></div>
          <div className="min-w-[8.25rem] flex-1"><StatChip label="Pendientes" value={pendientes} tone="sub" /></div>
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
                <p className="ft-body font-bold text-sm" style={{ color: TOKENS.ink }}>
                  Visita en curso · {abierta.local.nombre}
                </p>
                <p className="ft-mono text-xs text-muted">
                  Check-In: {new Date(abierta.entrada).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setNovedadLocal(abierta.local)}
                className="cursor-pointer rounded-lg border border-accent-ink bg-accent-soft px-3 py-2 text-xs font-semibold text-accent-ink transition hover:bg-surface-soft"
              >
                + Reportar Novedad
              </button>
              <button
                type="button"
                onClick={() =>
                  setMarca({
                    asignacionId: abierta.asignacionId,
                    visitaId: abierta.id,
                    nombre: abierta.local.nombre,
                  })
                }
                className="px-4 py-2 rounded-lg text-xs font-bold text-white shadow-sm transition cursor-pointer"
                style={{ background: TOKENS.critico }}
              >
                Marcar Salida (Check-Out)
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
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
        <div className="space-y-2.5">
          {itemsFiltrados.length === 0 ? (
            <div
              className="rounded-lg p-8 text-center"
              style={{ background: TOKENS.canvas, border: `1px solid ${TOKENS.line}` }}
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

              const tone = estado === "completado" ? "fresco" : estado === "en_curso" ? "frio" : "ink";
              const label = estado === "completado" ? "VISITADO" : estado === "en_curso" ? "EN CURSO" : "PENDIENTE";

              const horarios = a.local.horarios;
              const ventana = horarios.length
                ? `${horarios[0].entrada} – ${horarios[0].salida}`
                : "08:00 – 18:00";
              const ordenNumero = ordenRuta?.indexOf(a.id) ?? -1;

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
                        {ordenNumero >= 0 ? ordenNumero + 1 : i + 1}
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
                          In {new Date(ultimaVisita.entrada).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                      {ultimaVisita?.salida && (
                        <span className="ft-mono font-medium text-foreground">
                          Out {new Date(ultimaVisita.salida).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {origenGps && Number.isFinite(a.local.latitud) ? (
                        <span className="ft-mono hidden text-[10px] text-muted sm:inline">
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
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
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

                      {!estaEnCurso && !tieneVisitaCerrada && !abierta && (
                        <button
                          type="button"
                          onClick={() =>
                            setMarca({
                              asignacionId: a.id,
                              horarioId: a.local.horarios[0]?.id,
                              nombre: a.local.nombre,
                            })
                          }
                          className="h-11 min-h-11 shrink-0 rounded-lg bg-zinc-900 px-2.5 text-[11px] font-bold text-white transition hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 cursor-pointer dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                        >
                          Check-in
                        </button>
                      )}

                      {estaEnCurso && (
                        <button
                          type="button"
                          onClick={() =>
                            setMarca({
                              asignacionId: a.id,
                              visitaId: abierta.id,
                              nombre: a.local.nombre,
                            })
                          }
                          className="h-11 min-h-11 shrink-0 rounded-lg bg-red-600 px-2.5 text-[11px] font-bold text-white transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 cursor-pointer dark:bg-red-500"
                        >
                          Check-out
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
        {lista.datos && lista.datos.totalPages > 0 ? (
          <Paginacion
            page={lista.page}
            totalPages={lista.datos.totalPages}
            total={lista.datos.total}
            limit={lista.limit}
            onPageChange={lista.setPage}
            onLimitChange={lista.setLimit}
          />
        ) : null}
      </div>
      <PantallaCarga visible={calculandoRuta} mensaje="Calculando mejor ruta" detalle="Usamos tu GPS, los horarios y la distancia entre locales." />

      {/* Modal de Mapa */}
      {mapa && (
        <MapaLocal
          local={{
            id: 0,
            nombre: mapa.nombre,
            direccion: mapa.nombre,
            latitud: mapa.latitud,
            longitud: mapa.longitud,
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

      {/* Modal de Registro de Presencia (GPS) */}
      {marca && (
        <ModalMarcaPresencia
          marca={marca}
          cerrar={() => {
            setMarca(null);
            actualizar();
          }}
        />
      )}

      {/* Modal Reportar Novedad */}
      {novedadLocal && (
        <Modal
          titulo={`Novedad · ${novedadLocal.nombre}`}
          abierto={!!novedadLocal}
          onCerrar={() => setNovedadLocal(null)}
          ancho="md"
        >
          {novedadExito ? (
            <div className="py-6 text-center text-emerald-700 space-y-2">
              <svg className="w-12 h-12 mx-auto text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              <p className="ft-display text-xl font-bold">¡Novedad enviada con éxito!</p>
              <p className="ft-body text-xs text-muted">Tu Team Leader ya fue notificado.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="ft-body text-xs text-muted">
                Si ocurrió un imprevisto en este local (local cerrado, faltante de stock, reclamo de precio, etc.),
                reportalo para que tu supervisor intervenga.
              </p>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Tipo de Novedad:</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {(["INCIDENCIA", "RECLAMO", "CONSULTA", "SUGERENCIA"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTipoNovedad(t)}
                      className={`py-1.5 px-2 rounded-md text-xs font-semibold border transition cursor-pointer ${
                        tipoNovedad === t ? "bg-zinc-900 text-white border-zinc-900" : "bg-surface-raised text-foreground border-line"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Asunto / Título:</label>
                <input
                  type="text"
                  value={tituloNovedad}
                  onChange={(e) => setTituloNovedad(e.target.value)}
                  placeholder="Ej: Local cerrado por inventario"
                  className="w-full text-xs p-2.5 rounded-lg border border-line bg-surface-raised outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Descripción detallada:</label>
                <textarea
                  value={descNovedad}
                  onChange={(e) => setDescNovedad(e.target.value)}
                  rows={3}
                  placeholder="Detallá lo sucedido con la mayor precisión posible..."
                  className="w-full text-xs p-2.5 rounded-lg border border-line bg-surface-raised outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setNovedadLocal(null)}
                  className="flex-1 py-2 text-xs font-semibold border rounded-lg text-foreground"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={enviarNovedad}
                  disabled={!tituloNovedad.trim() || !descNovedad.trim() || guardandoNovedad}
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

// Modal para marcar entrada / salida con geolocalización
function ModalMarcaPresencia({
  marca,
  cerrar,
}: {
  marca: {
    asignacionId: number;
    horarioId?: number;
    visitaId?: number;
    nombre: string;
  };
  cerrar: () => void;
}) {
  const [gps, setGps] = useState<{ latitud?: number; longitud?: number } | null>(null);
  const [motivo, setMotivo] = useState("");
  const [obteniendo, setObteniendo] = useState(true);
  const op = useOperacionCampo();

  useEffect(() => {
    if (!navigator.geolocation) {
      queueMicrotask(() => setObteniendo(false));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({ latitud: pos.coords.latitude, longitud: pos.coords.longitude });
        setObteniendo(false);
      },
      () => {
        setObteniendo(false);
      },
      { timeout: 8000 },
    );
  }, []);

  const confirmar = async () => {
    await op.ejecutar(marca.visitaId ? "Registrando salida" : "Registrando entrada", async () => {
      if (marca.visitaId) {
        await apiFetch(`/campo/jornada/visitas/${marca.visitaId}/salida`, {
          method: "POST",
          body: JSON.stringify({
            latitud: gps?.latitud,
            longitud: gps?.longitud,
            nota: motivo.trim(),
          }),
        });
      } else {
        await apiFetch(`/campo/jornada/entrada`, {
          method: "POST",
          body: JSON.stringify({
            asignacionId: marca.asignacionId,
            horarioId: marca.horarioId,
            latitud: gps?.latitud,
            longitud: gps?.longitud,
            nota: motivo.trim(),
          }),
        });
      }
      cerrar();
    });
  };

  return (
    <Modal
      titulo={`${marca.visitaId ? "Marcar Salida" : "Marcar Entrada"} · ${marca.nombre}`}
      abierto
      onCerrar={cerrar}
      ancho="md"
    >
      <div className="space-y-3">
        <div className="p-3 rounded-lg bg-surface-soft border text-xs text-foreground">
          <p className="font-semibold">
            {obteniendo
              ? "Obteniendo ubicación GPS..."
              : gps
                ? `Ubicación GPS fijada (${gps.latitud?.toFixed(4)}, ${gps.longitud?.toFixed(4)})`
                : "No se pudo obtener coordenadas GPS automáticas."}
          </p>
        </div>

        {!gps && !obteniendo && (
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Motivo de registrar sin GPS:
            </label>
            <input
              type="text"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej: Sin señal en subsuelo"
              className="w-full text-xs p-2 rounded-md border border-line"
            />
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={cerrar}
            className="flex-1 py-2 text-xs font-semibold border rounded-lg text-foreground"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirmar}
            disabled={(!gps && motivo.trim().length < 3) || !!op.mensaje}
            className="flex-1 py-2 text-xs font-bold bg-[#1E2320] text-white rounded-lg hover:bg-black transition disabled:opacity-50 cursor-pointer"
          >
            Confirmar
          </button>
        </div>
      </div>
      <PantallaCarga visible={!!op.mensaje} mensaje={op.mensaje} />
    </Modal>
  );
}
