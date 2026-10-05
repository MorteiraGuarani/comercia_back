"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { apiFetch } from "@/lib/api";
import { Paginacion } from "@/components/paginacion";
import type { RespuestaSeguimiento } from "@/types/seguimiento";
import { estadoUbicacion, textoEstadoUbicacion } from "@/utils/seguimiento";

const MapaSeguimiento = dynamic(
  () => import("./mapa-seguimiento").then((m) => m.MapaSeguimiento),
  {
    ssr: false,
    loading: () => (
      <div className="grid min-h-80 place-items-center text-muted">
        Cargando mapa…
      </div>
    ),
  },
);

export function SeguimientoPanel() {
  const [datos, setDatos] = useState<RespuestaSeguimiento | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(7);
  const [buscar, setBuscar] = useState("");
  const [consulta, setConsulta] = useState("");
  const [error, setError] = useState("");
  const [seleccionada, setSeleccionada] = useState<number | null>(null);
  const [revision, setRevision] = useState(0);
  const [cargando, setCargando] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => {
      setConsulta(buscar.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [buscar]);
  useEffect(() => {
    let vigente = true;
    let pendiente = false;
    const abortador = new AbortController();
    async function cargar() {
      if (pendiente || document.hidden || !navigator.onLine) return;
      pendiente = true;
      try {
        const r = await apiFetch<RespuestaSeguimiento>(
          `/campo/seguimiento?page=${page}&limit=${limit}&buscar=${encodeURIComponent(consulta)}`,
          { signal: abortador.signal },
        );
        if (vigente) {
          setDatos(r);
          setError("");
        }
      } catch (e) {
        if (vigente)
          setError(
            e instanceof Error
              ? e.message
              : "No se pudo actualizar el seguimiento",
          );
      } finally {
        pendiente = false;
        if (vigente) setCargando(false);
      }
    }
    void cargar();
    const t = setInterval(() => void cargar(), 5000);
    const retomar = () => void cargar();
    document.addEventListener("visibilitychange", retomar);
    window.addEventListener("online", retomar);
    return () => {
      vigente = false;
      abortador.abort();
      clearInterval(t);
      document.removeEventListener("visibilitychange", retomar);
      window.removeEventListener("online", retomar);
    };
  }, [page, limit, consulta, revision]);
  return (
    <section className="w-full min-w-0 space-y-4 px-4 py-5 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">
            Seguimiento en vivo
          </h1>
          <p className="mt-1 text-sm text-muted">
            Últimas ubicaciones y actividad registrada de tu equipo.
            Actualización cada 5 segundos.
          </p>
        </div>
        <button
          type="button"
          className="min-h-11 rounded-lg border border-line px-4 text-foreground hover:bg-surface-soft focus-visible:ring-2 focus-visible:ring-focus"
          onClick={() => setRevision((n) => n + 1)}
        >
          Actualizar
        </button>
      </header>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["Colaboradores", datos?.resumen.colaboradores],
          ["Ubicaciones recientes", datos?.resumen.ubicacionesRecientes],
          ["Sin ubicación reciente", datos?.resumen.sinUbicacionReciente],
          ["Visitas abiertas", datos?.resumen.visitasAbiertas],
        ].map(([nombre, valor]) => (
          <div
            key={nombre}
            className="rounded-lg border border-line bg-surface-raised p-3"
          >
            <p className="text-xs text-muted">{nombre}</p>
            <p className="mt-1 text-xl font-bold text-foreground">
              {valor ?? "—"}
            </p>
          </div>
        ))}
      </div>
      <label className="block text-sm text-foreground">
        Buscar colaborador
        <input
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
          className="mt-1 min-h-11 w-full rounded-lg border border-line bg-surface-raised px-3 text-foreground"
          placeholder="Nombre o apellido"
        />
      </label>
      {error ? (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200"
        >
          {error}. Se conserva la última información recibida.
        </p>
      ) : null}
      <p className="text-xs text-muted">
        El mapa muestra los colaboradores de esta página. Verde: ubicación
        reciente. Gris: último punto desactualizado. Última actualización:{" "}
        {datos
          ? new Date(datos.actualizadaEn).toLocaleTimeString("es-PY")
          : "—"}
        .
      </p>
      <MapaSeguimiento
        personas={datos?.items ?? []}
        seleccionada={seleccionada}
      />
      {datos?.resumen.operacionesPendientes ? (
        <p
          role="status"
          className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100"
        >
          {datos.resumen.operacionesPendientes} marcaciones de tu equipo están
          pendientes de confirmar la sincronización.
        </p>
      ) : null}
      {cargando && !datos ? (
        <p role="status" className="py-5 text-center text-muted">
          Cargando equipo…
        </p>
      ) : null}
      <ul
        aria-label="Actividad de colaboradores"
        className="divide-y divide-line rounded-xl border border-line bg-surface-raised md:hidden"
      >
        {datos?.items.map((p) => (
          <li key={p.id} className="space-y-2 p-3">
            <p className="font-semibold text-foreground">
              {p.nombre}{" "}
              <span className="text-xs font-normal text-muted">· {p.rol}</span>
            </p>
            <p className="text-xs text-muted">
              {textoEstadoUbicacion(estadoUbicacion(p))} ·{" "}
              {p.telefono.capturadaEn
                ? new Date(p.telefono.capturadaEn).toLocaleTimeString("es-PY")
                : "Sin reporte"}
            </p>
            <p className="text-sm text-foreground">
              {p.visita?.local.nombre ?? "Sin visita abierta"}
            </p>
            <p className="text-xs text-muted">
              {p.visita?.actividad
                ? `${p.visita.actividad.estado}: ${p.visita.actividad.nombre}`
                : "Sin tarea iniciada"}
            </p>
            <p className="text-xs text-muted">
              {p.visita
                ? `${p.visita.completadas}/${p.visita.totalTareas} tareas completadas`
                : p.vinculada
                  ? "Cuenta vinculada"
                  : "Cuenta aún sin vincular"}
            </p>
            <button
              type="button"
              disabled={p.telefono.latitud === null}
              className="min-h-11 w-full rounded-lg border border-line text-foreground hover:bg-surface-soft disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => setSeleccionada(p.id)}
            >
              Ver en mapa
            </button>
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto rounded-xl border border-line md:block">
        <table className="w-full text-left text-sm text-foreground">
          <thead className="bg-surface-soft text-muted">
            <tr>
              {[
                "Colaborador",
                "Ubicación",
                "Local / tarea",
                "Progreso",
                "Mapa",
              ].map((x) => (
                <th key={x} className="p-3">
                  {x}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line bg-surface-raised">
            {datos?.items.map((p) => (
              <tr key={p.id}>
                <td className="p-3">
                  <p className="font-semibold">{p.nombre}</p>
                  <p className="text-xs text-muted">{p.rol}</p>
                </td>
                <td className="p-3">
                  <p>{textoEstadoUbicacion(estadoUbicacion(p))}</p>
                  <p className="text-xs text-muted">
                    {p.telefono.capturadaEn
                      ? new Date(p.telefono.capturadaEn).toLocaleTimeString(
                          "es-PY",
                        )
                      : "Sin reporte"}{" "}
                    · ±
                    {p.telefono.precisionMetros == null
                      ? "—"
                      : Math.round(p.telefono.precisionMetros)}{" "}
                    m
                  </p>
                </td>
                <td className="p-3">
                  <p>{p.visita?.local.nombre ?? "Sin visita abierta"}</p>
                  <p className="text-xs text-muted">
                    {p.visita?.actividad
                      ? `${p.visita.actividad.estado}: ${p.visita.actividad.nombre}`
                      : "Sin tarea iniciada"}
                  </p>
                </td>
                <td className="p-3">
                  {p.visita
                    ? `${p.visita.completadas}/${p.visita.totalTareas}`
                    : "—"}
                </td>
                <td className="p-3">
                  <button
                    type="button"
                    disabled={p.telefono.latitud === null}
                    className="min-h-11 rounded-lg border border-line px-3 hover:bg-surface-soft disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => setSeleccionada(p.id)}
                  >
                    Ver
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {datos?.total === 0 ? (
        <p className="p-4 text-sm text-muted">
          No hay colaboradores para esta selección.
        </p>
      ) : null}
      <Paginacion
        page={page}
        limit={limit}
        total={datos?.total ?? 0}
        totalPages={datos?.totalPages ?? 1}
        onPageChange={setPage}
        onLimitChange={setLimit}
      />
    </section>
  );
}
