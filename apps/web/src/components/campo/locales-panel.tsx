"use client";

import React, { useMemo, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { apiFetch } from "@/lib/api";
import { volverAlInicioDelListado } from "@/utils/scroll-listado";
import { useListaCampo, useOperacionCampo } from "@/hooks/use-lista-campo";
import { Modal } from "@/components/modal";
import { BotonEditar } from "@/components/boton-editar";
import { PantallaCarga } from "@/components/pantalla-carga";
import { TOKENS } from "./tokens";
import { StatusStamp } from "./ui/status-stamp";
import { StatChip } from "./ui/stat-chip";
import { TopBar } from "./ui/top-bar";
import { PlanLocal } from "./plan-local";
import { SelectorClienteCombobox } from "./selector-cliente-combobox";
import {
  IconoTienda,
  IconoMapa,
  IconoPlanificacion,
  IconoBuscar,
  IconoCruz,
  IconoMas,
  IconoFlechaIzq,
  IconoFlechaDer,
} from "./ui/iconos-campo";
import type { ClienteCampo, DatosLocalCampo, LocalCampo } from "@/types/campo";

const SelectorUbicacion = dynamic(() => import("./selector-ubicacion"), {
  ssr: false,
  loading: () => <p className="text-xs font-mono text-zinc-500 py-4 text-center">Cargando mapa GPS…</p>,
});
const MapaClientes = dynamic(() => import("./mapa-clientes").then((modulo) => modulo.MapaClientes), {
  ssr: false,
  loading: () => <p className="py-4 text-center text-sm text-muted">Cargando mapa de cobertura…</p>,
});

export function LocalesPanel() {
  const [mostrarMapaCobertura, setMostrarMapaCobertura] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [clienteFiltro, setClienteFiltro] = useState<number | "">("");
  const [filtroEstado, setFiltroEstado] = useState<"todos" | "activos" | "inactivos">("todos");

  const [clientes, setClientes] = useState<ClienteCampo[]>([]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mostrarMapa = params.get("mapa") === "1";
    const clienteId = Number(params.get("clienteId"));
    const frame = window.requestAnimationFrame(() => {
      if (mostrarMapa) setMostrarMapaCobertura(true);
      if (clienteId > 0) setClienteFiltro(clienteId);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  // Cargar la primera página de clientes para el filtro rápido.
  useEffect(() => {
    apiFetch<{ items: ClienteCampo[] }>("/campo/clientes?limit=50")
      .then((res) => setClientes(res.items || []))
      .catch(() => undefined);
  }, []);

  const endpoint = useMemo(() => {
    const params = new URLSearchParams();
    if (busqueda.trim()) params.set("buscar", busqueda.trim());
    if (clienteFiltro) params.set("clienteId", String(clienteFiltro));
    const qs = params.toString();
    return `/campo/locales${qs ? `?${qs}` : ""}`;
  }, [busqueda, clienteFiltro]);

  const lista = useListaCampo<LocalCampo>(endpoint, 0, 25);
  const op = useOperacionCampo();

  const [form, setForm] = useState<LocalCampo | null>(null);
  const [plan, setPlan] = useState<LocalCampo | null>(null);

  // Filtrado local por estado activo / inactivo
  const itemsFiltrados = useMemo(() => {
    return lista.items.filter((l) => {
      if (filtroEstado === "activos") return l.activo;
      if (filtroEstado === "inactivos") return !l.activo;
      return true;
    });
  }, [lista.items, filtroEstado]);

  const totalActivos = useMemo(() => lista.items.filter((l) => l.activo).length, [lista.items]);
  const totalInactivos = useMemo(() => lista.items.filter((l) => !l.activo).length, [lista.items]);

  const abrirCrear = () => {
    const clienteDefault =
      clienteFiltro && typeof clienteFiltro === "number"
        ? clientes.find((c) => c.id === clienteFiltro)
        : clientes[0];

    setForm({
      id: 0,
      clienteId: clienteDefault?.id ?? 0,
      cliente: { id: clienteDefault?.id ?? 0, nombre: clienteDefault?.nombre ?? "" },
      nombre: "",
      direccion: "",
      contacto: "",
      telefono: "",
      latitud: -25.2969,
      longitud: -57.6415,
      radioMetros: 100,
      zonaHoraria: "America/Asuncion",
      notas: "",
      activo: true,
    });
  };

  const totalRegistros = lista.datos?.total ?? lista.items.length;
  const desde = totalRegistros > 0 ? (lista.page - 1) * lista.limit + 1 : 0;
  const hasta = Math.min(lista.page * lista.limit, totalRegistros);

  return (
    <div
      className="campo-screen min-h-screen min-w-0 w-full text-[13px] font-sans pb-16"
      style={{ backgroundColor: TOKENS.bone, color: TOKENS.ink }}
    >
      <TopBar
        title="Puntos de Venta & Rutas"
        subtitle="Supermercados, carnicerías y bocas de expendio con franjas y asignaciones"
        right={
          <>
          <button type="button" onClick={() => setMostrarMapaCobertura((actual) => !actual)} aria-pressed={mostrarMapaCobertura} aria-label={mostrarMapaCobertura ? "Ocultar mapa de cobertura" : "Mostrar mapa de cobertura"} title={mostrarMapaCobertura ? "Ocultar mapa de cobertura" : "Mostrar mapa de cobertura"} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-line bg-surface-raised text-foreground transition hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600">
            <IconoMapa className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={abrirCrear}
            aria-label="Crear local"
            title="Crear local"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white shadow-sm transition-all hover:brightness-110 active:scale-95 cursor-pointer"
            style={{ backgroundColor: TOKENS.carne }}
          >
            <IconoMas className="w-4 h-4" />
          </button>
          </>
        }
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        {mostrarMapaCobertura && <MapaClientes clientes={clientes} clienteSeleccionadoId={typeof clienteFiltro === "number" ? clienteFiltro : null} />}
        {/* KPI: compacto y cerrado por defecto en móvil */}
        <details className="rounded-xl border border-line bg-surface-raised sm:hidden">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-foreground [&::-webkit-details-marker]:hidden">
            <span>Resumen de locales</span>
            <span className="text-xs font-mono text-muted">{totalRegistros} puntos de venta</span>
          </summary>
          <div className="grid grid-cols-3 gap-2 border-t border-line p-2">
            <StatChip label="Total" value={totalRegistros} color="ink" />
            <StatChip label="Activos" value={totalActivos} color="fresco" />
            <StatChip label="Inactivos" value={totalInactivos} color="alerta" />
          </div>
        </details>
        <div className="hidden grid-cols-3 gap-3.5 sm:grid">
          <StatChip
            label="Total Puntos de Venta"
            value={totalRegistros}
            sub="Red comercial"
            color="ink"
          />
          <StatChip
            label="Locales Activos"
            value={totalActivos}
            sub="Con visitas programadas"
            color="fresco"
          />
          <StatChip
            label="Locales Inactivos"
            value={totalInactivos}
            sub="Pausados o en baja"
            color="alerta"
          />
        </div>

        {/* Buscador & Filtros de Estado */}
        <div
          className="grid grid-cols-2 items-stretch gap-2 rounded-xl border p-3.5 shadow-xs bg-white md:flex md:items-center md:gap-3 md:justify-between"
          style={{ borderColor: TOKENS.line }}
        >
          {/* Input de Búsqueda */}
          <div className="relative min-w-0 md:flex-1">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-400 pointer-events-none">
              <IconoBuscar className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value);
                lista.setPage(1);
              }}
              placeholder="Buscar local por nombre comercial o dirección..."
              className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm rounded-lg border bg-white focus:outline-none focus:ring-2 focus:ring-[#1E2320]"
              style={{ borderColor: TOKENS.line }}
            />
            {busqueda && (
              <button
                type="button"
                onClick={() => setBusqueda("")}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-700 cursor-pointer"
              >
                <IconoCruz className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filtro por Cliente */}
          <div className="min-w-0 md:w-64">
            <select
              value={clienteFiltro}
              onChange={(e) => {
                setClienteFiltro(e.target.value ? Number(e.target.value) : "");
                lista.setPage(1);
              }}
              className="w-full py-2 px-3 text-xs sm:text-sm font-medium rounded-lg border bg-white text-[#1E2320] focus:outline-none focus:ring-2 focus:ring-[#1E2320] cursor-pointer"
              style={{ borderColor: TOKENS.line }}
            >
              <option value="">Todos los Clientes</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Segmented Filter */}
          <div
            className="col-span-2 flex min-w-0 items-center gap-1 overflow-x-auto rounded-lg border bg-[#ECE9E2]/60 p-1 md:col-span-1 md:shrink-0"
            style={{ borderColor: TOKENS.line }}
          >
            {(["todos", "activos", "inactivos"] as const).map((filtro) => {
              const activo = filtroEstado === filtro;
              return (
                <button
                  key={filtro}
                  type="button"
                  onClick={() => setFiltroEstado(filtro)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    activo ? "bg-[#1E2320] text-white shadow-xs" : "text-[#726C60] hover:text-[#1E2320]"
                  }`}
                >
                  {filtro}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tabla Compacta de Locales */}
        <div
          data-inicio-listado
          className="scroll-mt-20 rounded-xl border bg-white shadow-xs overflow-hidden"
          style={{ borderColor: TOKENS.line }}
        >
          {lista.cargando && !lista.items.length ? (
            <div className="py-16 text-center text-zinc-500">
              <div className="w-6 h-6 mx-auto border-2 border-[#1E2320] border-t-transparent rounded-full animate-spin mb-2.5" />
              <p className="text-xs font-mono">Cargando puntos de venta...</p>
            </div>
          ) : itemsFiltrados.length === 0 ? (
            <div className="py-12 px-4 text-center">
              <div className="w-10 h-10 mx-auto rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400 mb-2.5">
                <IconoTienda className="w-5 h-5" />
              </div>
              <p className="text-sm font-bold text-[#1E2320]">No se encontraron locales</p>
              <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
                {busqueda || clienteFiltro
                  ? "Prueba cambiando los filtros de búsqueda o cliente seleccionado."
                  : "Agrega tu primer punto de venta para asignar visitas y tareas."}
              </p>
              <button
                type="button"
                onClick={abrirCrear}
                aria-label="Crear local"
                title="Crear local"
                className="mt-3.5 inline-grid h-11 w-11 place-items-center rounded-lg text-white"
                style={{ backgroundColor: TOKENS.ink }}
              >
                <IconoMas className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <>
            <ul className="grid gap-2 p-3 md:hidden" aria-label="Puntos de venta">
              {itemsFiltrados.map((local) => (
                <li key={local.id} className="min-w-0 rounded-xl border border-line bg-surface-raised p-3 text-sm">
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="break-words font-semibold text-foreground">{local.nombre}</h3>
                      <p className="mt-1 break-words text-xs text-muted">{local.direccion || "Sin dirección"}</p>
                    </div>
                    <StatusStamp tone={local.activo ? "fresco" : "sub"} size="sm">{local.activo ? "ACTIVO" : "INACTIVO"}</StatusStamp>
                  </div>
                  <p className="mt-2 break-words text-xs text-foreground">Asignado: {local.asignaciones?.length ? local.asignaciones.map((asignacion) => `${asignacion.usuario.rol?.descripcion ?? "Impulsador"} ${asignacion.usuario.nombre} ${asignacion.usuario.apellido}`).join(", ") : "Sin asignar"}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <BotonEditar onClick={() => setForm(local)} etiqueta={`Editar local ${local.nombre}`} modo="texto" />
                    <button type="button" onClick={() => setPlan(local)} className="min-h-11 cursor-pointer rounded-lg border border-line text-xs font-semibold text-foreground hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600">Ruta</button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-line bg-surface-soft text-[11px] font-bold uppercase tracking-wider text-muted">
                    <th className="py-2.5 px-3.5">Acciones</th>
                    <th className="py-2.5 px-3.5">PDV</th>
                    <th className="py-2.5 px-3.5">Asignado</th>
                    <th className="py-2.5 px-3.5 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line text-xs">
                  {itemsFiltrados.map((local) => (
                    <tr key={local.id} className="transition-colors hover:bg-surface-soft">
                      <td className="whitespace-nowrap px-3.5 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <BotonEditar onClick={() => setForm(local)} etiqueta={`Editar local ${local.nombre}`} />
                          <button
                            type="button"
                            onClick={() => setPlan(local)}
                            className="inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-md border border-line px-2.5 font-semibold text-foreground hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                          >
                            <IconoPlanificacion className="h-3.5 w-3.5" />
                            Ruta
                          </button>
                        </div>
                      </td>
                      <td className="min-w-[180px] px-3.5 py-2.5">
                        <p className="font-semibold text-foreground">{local.nombre}</p>
                        <p className="mt-1 break-words text-[11px] text-muted">{local.direccion || "Sin dirección"}</p>
                      </td>
                      <td className="max-w-[220px] break-words px-3.5 py-2.5 text-foreground">
                        {local.asignaciones?.length
                          ? local.asignaciones.map((asignacion) => `${asignacion.usuario.rol?.descripcion ?? "Impulsador"} ${asignacion.usuario.nombre} ${asignacion.usuario.apellido}`).join(", ")
                          : <span className="text-muted">Sin asignar</span>}
                      </td>
                      <td className="whitespace-nowrap px-3.5 py-2.5 text-center">
                        <StatusStamp tone={local.activo ? "fresco" : "sub"} size="sm">
                          {local.activo ? "ACTIVO" : "INACTIVO"}
                        </StatusStamp>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}

          {/* Footer con Paginación Compacta */}
          {totalRegistros > 0 && (
            <div
              className="px-4 py-3 border-t bg-zinc-50/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs"
              style={{ borderColor: TOKENS.line }}
            >
              <div className="flex items-center gap-3 text-zinc-500">
                <span>
                  Mostrando <strong className="text-zinc-800">{desde}</strong> -{" "}
                  <strong className="text-zinc-800">{hasta}</strong> de{" "}
                  <strong className="text-zinc-800">{totalRegistros}</strong> locales
                </span>

                <div className="flex items-center gap-1.5 ml-2">
                  <span className="text-[11px] uppercase tracking-wider">Filas:</span>
                  <select
                    value={lista.limit}
                    onChange={(e) => {
                      volverAlInicioDelListado(e.currentTarget);
                      lista.setLimit(Number(e.target.value));
                    }}
                    className="py-1 px-2 rounded-md border bg-white text-zinc-800 font-semibold text-xs cursor-pointer"
                    style={{ borderColor: TOKENS.line }}
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={lista.page <= 1}
                  onClick={(e) => {
                    volverAlInicioDelListado(e.currentTarget);
                    lista.setPage(lista.page - 1);
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-bold uppercase tracking-wider bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-50 cursor-pointer shadow-xs transition"
                  style={{ borderColor: TOKENS.line }}
                >
                  <IconoFlechaIzq className="w-3.5 h-3.5" />
                  <span>Anterior</span>
                </button>

                <span className="px-2 font-mono font-semibold text-zinc-600">
                  {lista.page} / {lista.datos?.totalPages || 1}
                </span>

                <button
                  type="button"
                  disabled={lista.page >= (lista.datos?.totalPages || 1)}
                  onClick={(e) => {
                    volverAlInicioDelListado(e.currentTarget);
                    lista.setPage(lista.page + 1);
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-bold uppercase tracking-wider bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-50 cursor-pointer shadow-xs transition"
                  style={{ borderColor: TOKENS.line }}
                >
                  <span>Siguiente</span>
                  <IconoFlechaDer className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Modal de Planificación */}
      {plan && <PlanLocal local={plan} cerrar={() => setPlan(null)} />}

      {/* Modal de Creación / Edición */}
      <Modal
        titulo={form?.id ? `Editar Local · ${form.nombre}` : "Registrar Nuevo Local"}
        abierto={!!form}
        onCerrar={() => {
          if (!op.mensaje) setForm(null);
        }}
        ancho="lg"
      >
        {form && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!form.clienteId) {
                alert("Debes seleccionar un cliente o cadena comercial.");
                return;
              }
              const data: DatosLocalCampo = {
                clienteId: form.clienteId,
                nombre: form.nombre,
                direccion: form.direccion,
                contacto: form.contacto,
                telefono: form.telefono,
                latitud: form.latitud,
                longitud: form.longitud,
                radioMetros: form.radioMetros,
                zonaHoraria: form.zonaHoraria,
                notas: form.notas,
                activo: form.activo,
              };
              const id = form.id;
              if (
                await op.ejecutar(id ? "Actualizando local" : "Creando local", () =>
                  apiFetch(`/campo/locales${id ? `/${id}` : ""}`, {
                    method: id ? "PUT" : "POST",
                    body: JSON.stringify(data),
                  }),
                )
              ) {
                setForm(null);
                lista.refrescar();
              }
            }}
            className="space-y-4 pt-1"
          >
            {op.error && (
              <div className="p-2.5 rounded-lg border text-xs font-medium text-red-700 bg-red-50 border-red-200">
                {op.error}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Selector de Cliente con Input de búsqueda y Dropdown Div */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-600 mb-1">
                  Cliente o Cadena Comercial *
                </label>
                <SelectorClienteCombobox
                  valorId={form.clienteId}
                  clienteSeleccionado={form.cliente}
                  clientesIniciales={clientes}
                  alSeleccionar={(c) => {
                    setForm({
                      ...form,
                      clienteId: c.id,
                      cliente: {
                        id: c.id,
                        nombre: c.nombre,
                        logoUrl: c.logoUrl,
                      },
                    });
                  }}
                  alLimpiar={() => {
                    setForm({
                      ...form,
                      clienteId: 0,
                      cliente: { id: 0, nombre: "" },
                    });
                  }}
                  requerido
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-600 mb-1">
                  Nombre del Local / Sucursal *
                </label>
                <input
                  type="text"
                  required
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  placeholder="Ej: Biggie San Martín, Superseis Los Laureles..."
                  className="w-full px-3 py-2 rounded-lg border bg-white text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1E2320]"
                  style={{ borderColor: TOKENS.line }}
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-600 mb-1">
                Dirección Física
              </label>
              <input
                type="text"
                value={form.direccion}
                onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                placeholder="Ej: Avda. San Martín esq. Molas López"
                className="w-full px-3 py-2 rounded-lg border bg-white text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1E2320]"
                style={{ borderColor: TOKENS.line }}
              />
            </div>

            {/* Ubicación GPS interactiva */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-600 mb-1">
                Ubicación Satelital GPS (Pin en el Mapa)
              </label>
              <div className="rounded-xl border overflow-hidden" style={{ borderColor: TOKENS.line }}>
                <SelectorUbicacion
                  latitud={form.latitud}
                  longitud={form.longitud}
                  onChange={(lat, lng) =>
                    setForm({
                      ...form,
                      latitud: lat,
                      longitud: lng,
                    })
                  }
                />
              </div>
            </div>

            <div>
              <label htmlFor="local-radio-metros" className="block text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300 mb-1">
                Radio máximo para marcar (metros) *
              </label>
              <input
                id="local-radio-metros"
                type="number"
                min={10}
                max={5000}
                step={1}
                required
                value={form.radioMetros}
                onChange={(e) => setForm({ ...form, radioMetros: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg border border-line bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1E2320]"
              />
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Entrada y salida requieren GPS dentro de este radio. Valor inicial: 100 m.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-600 mb-1">
                  Referente / Contacto en el Local
                </label>
                <input
                  type="text"
                  value={form.contacto}
                  onChange={(e) => setForm({ ...form, contacto: e.target.value })}
                  placeholder="Ej: Encargado de Salón"
                  className="w-full px-3 py-2 rounded-lg border bg-white text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1E2320]"
                  style={{ borderColor: TOKENS.line }}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-600 mb-1">
                  Teléfono del Local
                </label>
                <input
                  type="text"
                  value={form.telefono}
                  onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                  placeholder="Ej: 0981 123456"
                  className="w-full px-3 py-2 rounded-lg border bg-white text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#1E2320]"
                  style={{ borderColor: TOKENS.line }}
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-600 mb-1">
                Notas Operativas / Instrucciones de Ingreso
              </label>
              <textarea
                rows={2}
                value={form.notas}
                onChange={(e) => setForm({ ...form, notas: e.target.value })}
                placeholder="Ej: Ingreso por portón trasero, presentar cédula en recepción..."
                className="w-full px-3 py-2 rounded-lg border bg-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2320]"
                style={{ borderColor: TOKENS.line }}
              />
            </div>

            <div className="flex items-center gap-2.5 pt-1">
              <input
                type="checkbox"
                id="local-activo-check"
                checked={form.activo}
                onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                className="w-4 h-4 rounded border-zinc-300 text-[#1E2320] focus:ring-[#1E2320] cursor-pointer"
              />
              <label htmlFor="local-activo-check" className="text-xs font-semibold text-zinc-800 cursor-pointer">
                Local Activo para Visitas y Rutas
              </label>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t" style={{ borderColor: TOKENS.line }}>
              <button
                type="button"
                onClick={() => setForm(null)}
                className="px-4 py-2 rounded-lg border text-xs font-bold uppercase tracking-wider bg-white hover:bg-zinc-50 cursor-pointer"
                style={{ borderColor: TOKENS.line }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!!op.mensaje}
                className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider text-white shadow-sm transition-all hover:brightness-110 disabled:opacity-50 cursor-pointer"
                style={{ backgroundColor: TOKENS.ink }}
              >
                {op.mensaje ? "Guardando..." : form.id ? "Guardar Cambios" : "Crear Local"}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <PantallaCarga
        visible={!!op.mensaje}
        mensaje={op.mensaje ?? "Procesando"}
        detalle="Guardando cambios en el servidor..."
      />
    </div>
  );
}
