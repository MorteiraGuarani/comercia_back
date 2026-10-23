"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { usePanel } from "@/components/panel/contexto";
import { Paginacion } from "@/components/paginacion";
import { PantallaCarga } from "@/components/pantalla-carga";
import { btnGhost, errorBox, inputBase } from "@/components/ui";
import type { EquipoEnVivo, PersonaEnVivo, Recorrido, TramoRecorrido } from "@/types/ubicacion";
import { formatoDistancia } from "@/utils/distancia";
import { formatoDuracionMinutos } from "@/utils/duracion";
import { mensajeError } from "@/utils/error";
import { formatoHora } from "@/utils/fechas";
import { normalizarBusqueda } from "@/utils/texto";
import { MINUTOS_SIN_SENAL, minutosDesde, textoHace, textoVelocidad } from "@/utils/ubicacion";
import { MapaUbicaciones } from "./mapa-ubicaciones";
import { StatChip } from "./ui/stat-chip";
import { TopBar } from "./ui/top-bar";

// Polling corto: funciona detrás de cualquier proxy, sin conexiones abiertas.
// Los puntos llegan cada ~30 s; mirar cada 15 s deja el mapa casi en vivo.
const REFRESCO_MS = 15_000;

const btnFila = `${btnGhost} min-h-11 whitespace-nowrap px-3`;
const textoTramo: Record<TramoRecorrido["tipo"], string> = {
  parada: "Detenido",
  movimiento: "En movimiento",
  sin_datos: "Sin señal",
};
const colorTramo: Record<TramoRecorrido["tipo"], string> = {
  parada: "bg-[#c98248] dark:bg-[#dea06a]",
  movimiento: "bg-[#0E65D8] dark:bg-[#5b9cf0]",
  sin_datos: "bg-zinc-400 dark:bg-zinc-500",
};

function estadoPersona(p: PersonaEnVivo, ahora: number) {
  if (!p.ultima) return { texto: "Sin ubicación hoy", apagado: true };
  const detalle = [textoHace(p.ultima.capturadaEn, ahora), `±${Math.round(p.ultima.precisionMetros)} m`, textoVelocidad(p.ultima.velocidadMps)];
  return {
    texto: detalle.filter(Boolean).join(" · "),
    apagado: minutosDesde(p.ultima.capturadaEn, ahora) > MINUTOS_SIN_SENAL,
  };
}

/**
 * Ubicación del equipo de campo: mapa en vivo con la última posición de cada
 * persona (superadmin: la empresa; líder: su cadena) y el recorrido de un día.
 */
export function UbicacionesPanel() {
  const { usuario } = usePanel();
  const [empresas, setEmpresas] = useState<{ id: number; nombre: string }[]>([]);
  const [empresaId, setEmpresaId] = useState<number | null>(null);
  const [equipo, setEquipo] = useState<EquipoEnVivo | null>(null);
  const [error, setError] = useState("");
  const [recarga, setRecarga] = useState(0);
  const [busqueda, setBusqueda] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(7);
  const [foco, setFoco] = useState<{ latitud: number; longitud: number } | null>(null);
  const [persona, setPersona] = useState<{ id: number; nombre: string } | null>(null);
  const [fecha, setFecha] = useState(() => new Date().toLocaleDateString("en-CA"));
  const [recorrido, setRecorrido] = useState<Recorrido | null>(null);
  const [pageTramos, setPageTramos] = useState(1);
  const [limitTramos, setLimitTramos] = useState(7);
  // Carga en curso = la última consulta terminada no es la pedida; los
  // refrescos periódicos no cambian la consulta y quedan en segundo plano.
  const consultaVivo = `${empresaId}|${recarga}`;
  const [vivoTerminado, setVivoTerminado] = useState("");
  const consultaRecorrido = persona ? `${persona.id}|${fecha}|${empresaId}|${recarga}` : "";
  const [recorridoTerminado, setRecorridoTerminado] = useState("");
  const cargando = persona ? recorridoTerminado !== consultaRecorrido : vivoTerminado !== consultaVivo;

  useEffect(() => {
    if (!usuario.esSuperadmin) return;
    apiFetch<{ empresas: { id: number; nombre: string }[] }>("/admin/usuarios/meta")
      .then((m) => setEmpresas(m.empresas))
      .catch(() => undefined);
  }, [usuario.esSuperadmin]);

  useEffect(() => {
    if (persona) return;
    let control: AbortController | null = null;
    const cargar = () => {
      if (document.hidden) return;
      control?.abort();
      const actual = new AbortController();
      control = actual;
      apiFetch<EquipoEnVivo>(`/campo/ubicaciones/equipo${empresaId ? `?empresaId=${empresaId}` : ""}`, {
        signal: actual.signal,
      })
        .then((d) => {
          setEquipo(d);
          setError("");
        })
        .catch((e: unknown) => {
          if (!actual.signal.aborted) setError(mensajeError(e, "No se pudo cargar la ubicación del equipo"));
        })
        .finally(() => {
          if (!actual.signal.aborted) setVivoTerminado(consultaVivo);
        });
    };
    cargar();
    const intervalo = setInterval(cargar, REFRESCO_MS);
    document.addEventListener("visibilitychange", cargar);
    return () => {
      control?.abort();
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", cargar);
    };
  }, [persona, empresaId, consultaVivo]);

  useEffect(() => {
    if (!persona) return;
    const control = new AbortController();
    apiFetch<Recorrido>(
      `/campo/ubicaciones/recorrido/${persona.id}?fecha=${fecha}${empresaId ? `&empresaId=${empresaId}` : ""}`,
      { signal: control.signal },
    )
      .then((r) => {
        setRecorrido(r);
        setPageTramos(1);
        setError("");
      })
      .catch((e: unknown) => {
        if (control.signal.aborted) return;
        setRecorrido(null);
        setError(mensajeError(e, "No se pudo cargar el recorrido"));
      })
      .finally(() => {
        if (!control.signal.aborted) setRecorridoTerminado(consultaRecorrido);
      });
    return () => control.abort();
  }, [persona, fecha, empresaId, consultaRecorrido]);

  const ahora = equipo ? Date.parse(equipo.actualizadaEn) : undefined;
  const personas = useMemo(() => equipo?.personas ?? [], [equipo]);
  const filtradas = useMemo(() => {
    const texto = normalizarBusqueda(busqueda);
    return texto ? personas.filter((p) => normalizarBusqueda(`${p.nombre} ${p.rol ?? ""}`).includes(texto)) : personas;
  }, [personas, busqueda]);
  const totalPages = Math.max(1, Math.ceil(filtradas.length / limit));
  // Un refresco puede achicar la lista: la página nunca queda fuera de rango.
  const paginaActual = Math.min(page, totalPages);
  const pagina = filtradas.slice((paginaActual - 1) * limit, paginaActual * limit);
  const conteo = useMemo(() => {
    const ref = ahora ?? 0;
    const conUbicacion = personas.filter((p) => p.ultima);
    const recientes = conUbicacion.filter((p) => minutosDesde(p.ultima!.capturadaEn, ref) <= MINUTOS_SIN_SENAL).length;
    return { recientes, viejas: conUbicacion.length - recientes, sinUbicacion: personas.length - conUbicacion.length };
  }, [personas, ahora]);
  const tramos = recorrido?.tramos ?? [];
  const paginaTramos = tramos.slice((pageTramos - 1) * limitTramos, pageTramos * limitTramos);
  const localDe = (t: TramoRecorrido) => recorrido?.visitas.find((v) => v.id === t.visitaId)?.local.nombre;

  const verRecorrido = (p: PersonaEnVivo) => {
    setRecorrido(null);
    setFoco(null);
    setPersona({ id: p.id, nombre: p.nombre });
  };
  const verEnMapa = (p: PersonaEnVivo) => {
    if (p.ultima) setFoco({ latitud: p.ultima.latitud, longitud: p.ultima.longitud });
  };
  const volver = () => {
    setPersona(null);
    setRecorrido(null);
    setFoco(null);
  };

  return (
    <div className="campo-screen min-w-0 w-full">
      <TopBar
        title={persona ? persona.nombre : "Ubicaciones"}
        subtitle={
          persona
            ? "Recorrido del día"
            : equipo
              ? `${equipo.empresa.nombre} · ${personas.length} ${personas.length === 1 ? "persona" : "personas"} · actualizado ${formatoHora(equipo.actualizadaEn)}`
              : "Dónde está el equipo de campo"
        }
        onBack={persona ? volver : undefined}
        right={
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {usuario.esSuperadmin && empresas.length > 1 && !persona ? (
              <label className="flex min-w-0 items-center gap-2 text-sm">
                <span className="sr-only">Empresa</span>
                <select
                  value={empresaId ?? equipo?.empresa.id ?? ""}
                  onChange={(e) => {
                    setEmpresaId(Number(e.target.value));
                    setPage(1);
                  }}
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
            {persona ? (
              <label className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground">
                Día
                <input
                  type="date"
                  value={fecha}
                  max={new Date().toLocaleDateString("en-CA")}
                  onChange={(e) => e.target.value && setFecha(e.target.value)}
                  className={`${inputBase} min-h-11 w-auto`}
                />
              </label>
            ) : null}
            <button type="button" className={btnGhost} onClick={() => setRecarga((n) => n + 1)} disabled={cargando}>
              Actualizar
            </button>
          </div>
        }
      />
      <PantallaCarga visible={cargando} mensaje={persona ? "Armando el recorrido" : "Buscando la ubicación del equipo"} />

      <div className="mx-auto w-full min-w-0 max-w-7xl space-y-3 px-4 py-4 sm:px-6 lg:px-8">
        {error ? (
          <div className={errorBox}>
            {error}{" "}
            <button type="button" className={btnGhost} onClick={() => setRecarga((n) => n + 1)}>
              Reintentar
            </button>
          </div>
        ) : null}

        {persona ? (
          <>
            {recorrido ? (
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                <StatChip label="Distancia" value={formatoDistancia(recorrido.resumen.metros)} />
                <StatChip label="En movimiento" value={formatoDuracionMinutos(recorrido.resumen.minutosEnMovimiento)} tone="frio" />
                <StatChip label="Detenido" value={formatoDuracionMinutos(recorrido.resumen.minutosDetenido)} tone="alerta" />
                <StatChip
                  label="Sin señal"
                  value={formatoDuracionMinutos(recorrido.resumen.minutosSinDatos)}
                  tone="sub"
                  sub={
                    recorrido.resumen.inicio && recorrido.resumen.fin
                      ? `De ${formatoHora(recorrido.resumen.inicio)} a ${formatoHora(recorrido.resumen.fin)}`
                      : undefined
                  }
                />
              </div>
            ) : null}
            <MapaUbicaciones
              recorrido={recorrido}
              encuadre={consultaRecorrido}
              foco={foco}
              etiqueta={`Recorrido de ${persona.nombre}`}
            />
            {recorrido && !recorrido.puntos.length ? (
              <p className="rounded-xl border border-line bg-surface-raised p-4 text-sm text-muted">
                No hay ubicaciones registradas ese día. Se registran mientras la persona tiene la app abierta durante su jornada.
              </p>
            ) : null}
            {tramos.length ? (
              <section className="rounded-xl border border-line bg-surface-raised p-3 sm:p-4">
                <h2 className="text-sm font-bold text-foreground">Línea de tiempo</h2>
                {recorrido?.resumen.descartados ? (
                  <p className="mt-1 text-xs text-muted">
                    {recorrido.resumen.descartados} puntos con poca precisión no se usaron.
                  </p>
                ) : null}
                <ol aria-label="Línea de tiempo del recorrido" className="mt-2 divide-y divide-line">
                  {paginaTramos.map((t) => {
                    const local = localDe(t);
                    return (
                      <li key={`${t.tipo}-${t.desde}`} className="flex min-w-0 items-center gap-3 py-2.5 [content-visibility:auto]">
                        <span className={`h-3 w-3 shrink-0 rounded-full ${colorTramo[t.tipo]}`} aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {textoTramo[t.tipo]}
                            {local ? ` · ${local}` : ""}
                          </p>
                          <p className="text-xs text-muted [font-variant-numeric:tabular-nums]">
                            {formatoHora(t.desde)} – {formatoHora(t.hasta)} · {formatoDuracionMinutos(t.minutos)}
                            {t.tipo !== "parada" ? ` · ${formatoDistancia(t.metros)}` : ""}
                          </p>
                        </div>
                        {t.tipo === "parada" && t.latitud !== undefined && t.longitud !== undefined ? (
                          <button
                            type="button"
                            className={btnFila}
                            onClick={() => setFoco({ latitud: t.latitud!, longitud: t.longitud! })}
                            aria-label={`Ver en el mapa la parada de las ${formatoHora(t.desde)}`}
                          >
                            Ver
                          </button>
                        ) : null}
                      </li>
                    );
                  })}
                </ol>
                <Paginacion
                  page={pageTramos}
                  totalPages={Math.max(1, Math.ceil(tramos.length / limitTramos))}
                  total={tramos.length}
                  limit={limitTramos}
                  onPageChange={setPageTramos}
                  onLimitChange={(l) => {
                    setLimitTramos(l);
                    setPageTramos(1);
                  }}
                  desplazarAlInicio={false}
                />
              </section>
            ) : null}
          </>
        ) : (
          <>
            {equipo ? (
              <div className="grid grid-cols-3 gap-2">
                <StatChip label="Con señal" value={conteo.recientes} tone="fresco" sub={`Últimos ${MINUTOS_SIN_SENAL} min`} />
                <StatChip label="Sin señal reciente" value={conteo.viejas} tone="alerta" />
                <StatChip label="Sin ubicación hoy" value={conteo.sinUbicacion} tone="sub" />
              </div>
            ) : null}
            <MapaUbicaciones
              personas={personas}
              ahora={ahora}
              encuadre={`vivo|${equipo?.empresa.id ?? ""}`}
              foco={foco}
              etiqueta="Mapa en vivo del equipo"
            />
            <section className="rounded-xl border border-line bg-surface-raised p-3 sm:p-4">
              <label className="block">
                <span className="sr-only">Buscar persona</span>
                <input
                  type="search"
                  value={busqueda}
                  onChange={(e) => {
                    setBusqueda(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Buscar por nombre o rol"
                  className={inputBase}
                />
              </label>
              {equipo && !filtradas.length ? (
                <p className="mt-3 text-sm text-muted">
                  {personas.length ? "Nadie coincide con la búsqueda." : "No hay personas de campo a tu cargo."}
                </p>
              ) : null}

              <ul aria-label="Equipo" className="mt-2 divide-y divide-line md:hidden">
                {pagina.map((p) => {
                  const estado = estadoPersona(p, ahora ?? 0);
                  return (
                    <li key={p.id} className="py-2.5">
                      <p className="truncate text-sm font-semibold text-foreground">{p.nombre}</p>
                      <p className="truncate text-xs text-muted">{p.rol ?? "Sin rol"}</p>
                      <p className={`mt-0.5 text-xs ${estado.apagado ? "text-muted" : "font-semibold text-emerald-700 dark:text-emerald-300"}`}>
                        {estado.texto}
                      </p>
                      <div className="mt-2 flex gap-2">
                        <button type="button" className={`${btnFila} flex-1`} onClick={() => verEnMapa(p)} disabled={!p.ultima}>
                          Ver en mapa
                        </button>
                        <button type="button" className={`${btnFila} flex-1`} onClick={() => verRecorrido(p)}>
                          Recorrido
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <table className="mt-2 hidden w-full text-left text-sm md:table">
                <thead className="text-xs text-muted">
                  <tr>
                    <th className="py-2 font-semibold">Persona</th>
                    <th className="py-2 font-semibold">Rol</th>
                    <th className="py-2 font-semibold">Última posición</th>
                    <th className="py-2 text-right font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {pagina.map((p) => {
                    const estado = estadoPersona(p, ahora ?? 0);
                    return (
                      <tr key={p.id} className="hover:bg-surface-soft">
                        <td className="py-2 font-semibold text-foreground">{p.nombre}</td>
                        <td className="py-2 text-muted">{p.rol ?? "Sin rol"}</td>
                        <td className={`py-2 ${estado.apagado ? "text-muted" : "font-semibold text-emerald-700 dark:text-emerald-300"}`}>
                          {estado.texto}
                        </td>
                        <td className="py-2">
                          <div className="flex justify-end gap-2">
                            <button type="button" className={btnFila} onClick={() => verEnMapa(p)} disabled={!p.ultima}>
                              Ver en mapa
                            </button>
                            <button type="button" className={btnFila} onClick={() => verRecorrido(p)}>
                              Recorrido
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <Paginacion
                page={paginaActual}
                totalPages={totalPages}
                total={filtradas.length}
                limit={limit}
                onPageChange={setPage}
                onLimitChange={(l) => {
                  setLimit(l);
                  setPage(1);
                }}
                desplazarAlInicio={false}
              />
            </section>
          </>
        )}
      </div>
    </div>
  );
}
