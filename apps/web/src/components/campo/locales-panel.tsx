"use client";

import React, { useMemo, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { apiFetch } from "@/lib/api";
import { Paginacion } from "@/components/paginacion";
import { useListaCampo, useOperacionCampo } from "@/hooks/use-lista-campo";
import { Modal } from "@/components/modal";
import { BotonEditar } from "@/components/boton-editar";
import { BotonEliminarCampo } from "./boton-eliminar-campo";
import { ConfirmarEliminacionCampo } from "./confirmar-eliminacion-campo";
import { PantallaCarga } from "@/components/pantalla-carga";
import { TOKENS } from "./tokens";
import { BuscadorCatalogo, KpisFiltro } from "./ui/filtros-catalogo";
import { TopBar } from "./ui/top-bar";
import { PlanLocal } from "./plan-local";
import { usePanel } from "@/components/panel/contexto";
import { esRolLiderCampo } from "@/utils/rol-campo";
import { SelectorClienteCombobox } from "./selector-cliente-combobox";
import { TarjetaPdv } from "./tarjeta-pdv";
import { FotoLocal } from "./ui/foto-local";
import {
  IconoTienda,
  IconoMapa,
  IconoPlanificacion,
  IconoCheck,
  IconoCliente,
  IconoCruz,
  IconoMas,
} from "./ui/iconos-campo";
import type {
  ClienteCampo,
  DatosLocalCampo,
  LocalCampo,
  RespuestaLocalesCampo,
} from "@/types/campo";

const SelectorUbicacion = dynamic(() => import("./selector-ubicacion"), {
  ssr: false,
  loading: () => (
    <p className="text-xs font-mono text-zinc-500 py-4 text-center">
      Cargando mapa GPS…
    </p>
  ),
});
const MapaClientes = dynamic(
  () => import("./mapa-clientes").then((modulo) => modulo.MapaClientes),
  {
    ssr: false,
    loading: () => (
      <p className="py-4 text-center text-sm text-muted">
        Cargando mapa de cobertura…
      </p>
    ),
  },
);

export function LocalesPanel() {
  const [mostrarMapaCobertura, setMostrarMapaCobertura] = useState(false);
  const { usuario } = usePanel();
  // TeamLeader y Supervisor ven los locales y su planificación sin editarlos.
  const soloLectura = esRolLiderCampo(usuario.rol?.descripcion);
  const [busqueda, setBusqueda] = useState("");
  const [clienteFiltro, setClienteFiltro] = useState<number | "">("");
  const [clienteSeleccionadoFiltro, setClienteSeleccionadoFiltro] =
    useState<ClienteCampo | null>(null);
  const [sinCliente, setSinCliente] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState<
    "todos" | "activos" | "inactivos"
  >("todos");

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
    if (sinCliente) params.set("sinCliente", "true");
    params.set("estado", filtroEstado);
    params.set("conResumen", "1");
    const qs = params.toString();
    return `/campo/locales${qs ? `?${qs}` : ""}`;
  }, [busqueda, clienteFiltro, sinCliente, filtroEstado]);

  const lista = useListaCampo<LocalCampo>(endpoint, 0, 7);
  const op = useOperacionCampo();

  const [form, setForm] = useState<LocalCampo | null>(null);
  const [plan, setPlan] = useState<LocalCampo | null>(null);
  const [eliminando, setEliminando] = useState<LocalCampo | null>(null);
  const [revisionMapa, setRevisionMapa] = useState(0);

  function abrirEliminar(local: LocalCampo) {
    op.limpiarError();
    setEliminando(local);
  }

  async function eliminar() {
    if (!eliminando) return;
    const ok = await op.ejecutar("Eliminando local", () =>
      apiFetch(`/campo/locales/${eliminando.id}`, { method: "DELETE" }),
    );
    if (ok) {
      setEliminando(null);
      setRevisionMapa((valor) => valor + 1);
      lista.refrescar();
    }
  }

  const itemsFiltrados = lista.items;

  // Contadores reales de la API (no solo de la página visible).
  const resumen = (lista.datos as RespuestaLocalesCampo | null)?.resumen;

  const abrirCrear = () => {
    const clienteDefault =
      clienteFiltro && typeof clienteFiltro === "number"
        ? clientes.find((c) => c.id === clienteFiltro)
        : clientes[0];

    setForm({
      id: 0,
      clienteId: clienteDefault?.id ?? null,
      cliente: clienteDefault
        ? { id: clienteDefault.id, nombre: clienteDefault.nombre }
        : null,
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
            <button
              type="button"
              onClick={() => setMostrarMapaCobertura((actual) => !actual)}
              aria-pressed={mostrarMapaCobertura}
              aria-label={
                mostrarMapaCobertura
                  ? "Ocultar mapa de cobertura"
                  : "Mostrar mapa de cobertura"
              }
              title={
                mostrarMapaCobertura
                  ? "Ocultar mapa de cobertura"
                  : "Mostrar mapa de cobertura"
              }
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-line bg-surface-raised text-foreground transition hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
            >
              <IconoMapa className="h-5 w-5" />
            </button>
            {soloLectura ? null : (
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
            )}
          </>
        }
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        {mostrarMapaCobertura && (
          <MapaClientes
            key={revisionMapa}
            clientes={clientes}
            clienteSeleccionadoId={
              typeof clienteFiltro === "number" ? clienteFiltro : null
            }
          />
        )}
        {/* Indicadores que filtran: reemplazan las pestañas de estado y "sin cliente" */}
        <KpisFiltro
          etiqueta="Filtrar puntos de venta"
          seleccionado={sinCliente ? "sin_cliente" : filtroEstado}
          onSeleccionar={(clave) => {
            if (clave === "sin_cliente") {
              setSinCliente(true);
              setFiltroEstado("todos");
              setClienteFiltro("");
              setClienteSeleccionadoFiltro(null);
            } else {
              setSinCliente(false);
              setFiltroEstado(clave);
            }
            lista.setPage(1);
          }}
          items={[
            {
              clave: "todos",
              etiqueta: "Locales",
              valor: resumen?.total ?? "—",
              detalle: "Red de puntos de venta",
              icono: <IconoTienda />,
              tono: "marca",
            },
            {
              clave: "activos",
              etiqueta: "Activos",
              valor: resumen?.activos ?? "—",
              detalle: "Con visitas programadas",
              icono: <IconoCheck />,
              tono: "verde",
            },
            {
              clave: "inactivos",
              etiqueta: "Inactivos",
              valor: resumen?.inactivos ?? "—",
              detalle: "Pausados o en baja",
              icono: <IconoCruz />,
              tono: "gris",
            },
            {
              clave: "sin_cliente",
              etiqueta: "Sin cliente",
              valor: resumen?.sinCliente ?? "—",
              detalle: "Falta asociar cliente",
              icono: <IconoCliente />,
              tono: "ambar",
            },
          ]}
        />

        {/* Buscador y cliente */}
        <div className="grid min-w-0 grid-cols-2 gap-2 md:grid-cols-[minmax(0,1fr)_18rem] md:gap-3">
          <BuscadorCatalogo
            valor={busqueda}
            onCambio={(valor) => {
              setBusqueda(valor);
              lista.setPage(1);
            }}
            placeholder="Buscar local…"
            etiqueta="Buscar punto de venta"
          />
          <div className="min-w-0">
            <SelectorClienteCombobox
              valorId={clienteFiltro || null}
              clienteSeleccionado={
                clienteSeleccionadoFiltro ??
                clientes.find((cliente) => cliente.id === clienteFiltro)
              }
              placeholder="Cliente: todos"
              compacto
              alSeleccionar={(cliente) => {
                setClienteFiltro(cliente.id);
                setClienteSeleccionadoFiltro(cliente);
                setSinCliente(false);
                lista.setPage(1);
              }}
              alLimpiar={() => {
                setClienteFiltro("");
                setClienteSeleccionadoFiltro(null);
                lista.setPage(1);
              }}
            />
          </div>
        </div>

        {/* Tabla Compacta de Locales */}
        <div
          data-inicio-listado
          className="scroll-mt-20 rounded-xl border border-line bg-surface-raised shadow-xs overflow-hidden"
          style={{ borderColor: TOKENS.line }}
        >
          {lista.cargando && !lista.items.length ? (
            <div className="py-16 text-center text-muted">
              <div className="w-6 h-6 mx-auto border-2 border-foreground border-t-transparent rounded-full animate-spin mb-2.5" />
              <p className="text-xs font-mono">Cargando puntos de venta...</p>
            </div>
          ) : itemsFiltrados.length === 0 ? (
            <div className="py-12 px-4 text-center">
              <div className="w-10 h-10 mx-auto rounded-full bg-surface-soft flex items-center justify-center text-muted mb-2.5">
                <IconoTienda className="w-5 h-5" />
              </div>
              <p className="text-sm font-bold text-foreground">
                No se encontraron locales
              </p>
              <p className="text-xs text-muted mt-1 max-w-sm mx-auto">
                {busqueda || clienteFiltro
                  ? "Prueba cambiando los filtros de búsqueda o cliente seleccionado."
                  : soloLectura
                    ? "Todavía no hay puntos de venta cargados."
                    : "Agrega tu primer punto de venta para asignar visitas y tareas."}
              </p>
              {soloLectura ? null : (
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
              )}
            </div>
          ) : (
            <>
              <ul
                className="grid gap-2.5 p-2.5 md:hidden"
                aria-label="Puntos de venta"
              >
                {itemsFiltrados.map((local) => (
                  <li key={local.id} className="min-w-0">
                    <TarjetaPdv
                      local={local}
                      ocupado={!!op.mensaje}
                      onEditar={soloLectura ? undefined : () => setForm(local)}
                      onRuta={() => setPlan(local)}
                      onEliminar={soloLectura ? undefined : () => abrirEliminar(local)}
                    />
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
                      <tr
                        key={local.id}
                        className="transition-colors hover:bg-surface-soft"
                      >
                        <td className="whitespace-nowrap px-3.5 py-2.5">
                          <div className="flex items-center gap-1.5">
                            {soloLectura ? null : (
                              <BotonEditar
                                onClick={() => setForm(local)}
                                etiqueta={`Editar local ${local.nombre}`}
                              />
                            )}
                            <button
                              type="button"
                              onClick={() => setPlan(local)}
                              className="inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-md border border-line px-2.5 font-semibold text-foreground hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                            >
                              <IconoPlanificacion className="h-3.5 w-3.5" />
                              Ruta
                            </button>
                            {soloLectura ? null : (
                              <BotonEliminarCampo
                                onClick={() => abrirEliminar(local)}
                                etiqueta={`Eliminar local ${local.nombre}`}
                                disabled={!!op.mensaje}
                              />
                            )}
                          </div>
                        </td>
                        <td className="min-w-[240px] px-3.5 py-2.5">
                          <div className="flex min-w-0 items-center gap-3">
                            <FotoLocal
                              nombre={local.nombre}
                              cliente={local.cliente}
                              className="w-16 shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-foreground">
                                {local.nombre}
                              </p>
                              <p
                                className={`mt-0.5 break-words text-[11px] font-semibold ${local.cliente ? "text-brand-700 dark:text-brand-200" : "text-amber-700 dark:text-amber-300"}`}
                              >
                                {local.cliente?.nombre ?? "Sin cliente"}
                              </p>
                              <p className="mt-0.5 break-words text-[11px] text-muted">
                                {local.direccion || "Sin dirección"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="max-w-[260px] px-3.5 py-2.5">
                          <div className="flex flex-wrap gap-1">
                            {local.asignaciones?.length ? (
                              local.asignaciones.map((asignacion) => (
                                <span
                                  key={asignacion.id}
                                  title={
                                    asignacion.usuario.rol?.descripcion ??
                                    undefined
                                  }
                                  className="inline-flex max-w-full items-center rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-900 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-200"
                                >
                                  <span className="truncate">
                                    {asignacion.usuario.nombre}{" "}
                                    {asignacion.usuario.apellido}
                                  </span>
                                </span>
                              ))
                            ) : (
                              <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300">
                                Sin asignar
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-3.5 py-2.5 text-center">
                          <span
                            className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-bold ${local.activo ? "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300" : "border-stone-300 bg-stone-100 text-stone-700 dark:border-stone-700 dark:bg-stone-800/70 dark:text-stone-200"}`}
                          >
                            {local.activo ? "Activo" : "Inactivo"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <Paginacion
            page={lista.page}
            totalPages={lista.datos?.totalPages ?? 1}
            total={totalRegistros}
            limit={lista.limit}
            onPageChange={lista.setPage}
            onLimitChange={lista.setLimit}
          />
        </div>
      </main>

      {/* Modal de Planificación */}
      {plan && <PlanLocal local={plan} cerrar={() => setPlan(null)} />}

      {/* Modal de Creación / Edición */}
      <Modal
        titulo={
          form?.id ? `Editar Local · ${form.nombre}` : "Registrar Nuevo Local"
        }
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
                await op.ejecutar(
                  id ? "Actualizando local" : "Creando local",
                  () =>
                    apiFetch(`/campo/locales${id ? `/${id}` : ""}`, {
                      method: id ? "PUT" : "POST",
                      body: JSON.stringify(data),
                    }),
                )
              ) {
                setForm(null);
                setRevisionMapa((valor) => valor + 1);
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
                  Cliente o Cadena Comercial
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
                      clienteId: null,
                      cliente: null,
                    });
                  }}
                  placeholder="Sin cliente"
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
                onChange={(e) =>
                  setForm({ ...form, direccion: e.target.value })
                }
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
              <div
                className="rounded-xl border overflow-hidden"
                style={{ borderColor: TOKENS.line }}
              >
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
              <label
                htmlFor="local-radio-metros"
                className="block text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300 mb-1"
              >
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
                onChange={(e) =>
                  setForm({ ...form, radioMetros: Number(e.target.value) })
                }
                className="w-full px-3 py-2 rounded-lg border border-line bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1E2320]"
              />
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Entrada y salida requieren GPS dentro de este radio. Valor
                inicial: 100 m.
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
                  onChange={(e) =>
                    setForm({ ...form, contacto: e.target.value })
                  }
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
                  onChange={(e) =>
                    setForm({ ...form, telefono: e.target.value })
                  }
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
              <label
                htmlFor="local-activo-check"
                className="text-xs font-semibold text-zinc-800 cursor-pointer"
              >
                Local Activo para Visitas y Rutas
              </label>
            </div>

            <div
              className="flex items-center justify-end gap-2.5 pt-3 border-t"
              style={{ borderColor: TOKENS.line }}
            >
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
                {op.mensaje
                  ? "Guardando..."
                  : form.id
                    ? "Guardar Cambios"
                    : "Crear Local"}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {eliminando && (
        <ConfirmarEliminacionCampo
          tipo="local"
          nombre={eliminando.nombre}
          procesando={!!op.mensaje}
          error={op.error}
          onCerrar={() => setEliminando(null)}
          onConfirmar={() => void eliminar()}
        />
      )}
      <PantallaCarga
        visible={!!op.mensaje}
        mensaje={op.mensaje ?? "Procesando"}
        detalle="Actualizando el catálogo..."
      />
    </div>
  );
}
