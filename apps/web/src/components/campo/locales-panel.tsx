"use client";

import React, { useMemo, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Paginacion } from "@/components/paginacion";
import { usePanel } from "@/components/panel/contexto";
import { useListaCampo } from "@/hooks/use-lista-campo";
import { IconoMas } from "@/components/icono-mas";
import { ClienteModal, type PestanaCliente } from "./cliente-modal";
import { TOKENS } from "./tokens";
import { BuscadorCatalogo } from "./ui/filtros-catalogo";
import { TopBar } from "./ui/top-bar";
import { TarjetaPdv } from "./tarjeta-pdv";
import { AdministracionSupervisor } from "./administracion-supervisor";
import { AccionesItinerario } from "./acciones-itinerario";
import { FotoLocal } from "./ui/foto-local";
import { TextoExpandible } from "./ui/texto-expandible";
import {
  IconoAlerta,
  IconoCalendario,
  IconoMapa,
  IconoPin,
  IconoTienda,
} from "./ui/iconos-campo";
import { formatearTelefono } from "@/utils/telefono";
import { ConfigVencimientosModal } from "./config-vencimientos-modal";
import type { ClientePdv, EstadoLocales } from "@/types/campo";
import { SelectorPaginado } from "@/components/selector-paginado";
import { LocalesPorColaborador } from "./locales-por-colaborador";
import { TraspasoLocalesModal } from "./traspaso-locales-modal";

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

/**
 * Puntos de venta = socios de negocio de OCRD. Permite crear el cliente,
 * marcar su ubicación y planificar la ruta con el permiso de esta página.
 */
export function LocalesPanel() {
  const { usuario } = usePanel();
  // Supervisores buscan por persona y sus locales; los demás, por texto.
  const esSupervisor =
    !usuario.esSuperadmin &&
    (usuario.rol?.descripcion ?? "")
      .toLowerCase()
      .replace(/[^a-z]/g, "")
      .startsWith("supervisor");
  // Supervisor: su búsqueda vuelve a consultar al cerrar un modal que guardó.
  const [revisionSupervisor, setRevisionSupervisor] = useState(0);
  const [mostrarMapaCobertura, setMostrarMapaCobertura] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  // Filtros y agrupador de la vista de back office (el supervisor tiene la suya).
  const [colaborador, setColaborador] = useState<{
    id: number;
    nombre: string;
  } | null>(null);
  const [estado, setEstado] = useState<EstadoLocales>("");
  const [vista, setVista] = useState<"locales" | "colaboradores">("locales");
  const [traspaso, setTraspaso] = useState<{
    origen?: { id: number; nombre: string };
  } | null>(null);
  const [modal, setModal] = useState<{
    cliente?: ClientePdv;
    pestana?: PestanaCliente;
  } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mapa") !== "1") return;
    const frame = window.requestAnimationFrame(() =>
      setMostrarMapaCobertura(true),
    );
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const endpoint = useMemo(() => {
    const params = new URLSearchParams();
    if (busqueda.trim()) params.set("buscar", busqueda.trim());
    if (colaborador) params.set("usuarioId", String(colaborador.id));
    if (estado) params.set("estado", estado);
    const qs = params.toString();
    return `/campo/locales${qs ? `?${qs}` : ""}`;
  }, [busqueda, colaborador, estado]);

  const lista = useListaCampo<ClientePdv>(
    endpoint,
    0,
    7,
    !esSupervisor && vista === "locales",
  );
  const [revisionMapa, setRevisionMapa] = useState(0);
  const [configVencimientos, setConfigVencimientos] = useState(false);

  const totalRegistros = lista.datos?.total ?? lista.items.length;

  return (
    <div
      className="campo-screen min-h-screen min-w-0 w-full text-[13px] font-sans pb-16"
      style={{ backgroundColor: TOKENS.bone, color: TOKENS.ink }}
    >
      <TopBar
        title="Administración"
        subtitle={
          esSupervisor
            ? "Buscá por colaborador o por local de venta"
            : "Clientes con su ubicación, horarios y personal asignado"
        }
        right={
          <>
            <button
              type="button"
              disabled
              aria-label="Crear cliente"
              title="Crear cliente"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-700 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-brand-500 dark:text-zinc-950"
            >
              <IconoMas className="h-5 w-5" />
            </button>
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
            <button
              type="button"
              onClick={() => setConfigVencimientos(true)}
              aria-label="Avisos de vencimiento"
              title="Avisos de vencimiento del inventario"
              className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-xl border border-line bg-surface-raised text-foreground transition hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
            >
              <IconoCalendario className="h-5 w-5" />
            </button>
          </>
        }
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        {mostrarMapaCobertura && <MapaClientes key={revisionMapa} />}

        {esSupervisor ? (
          <AdministracionSupervisor
            usuarioId={usuario.id}
            revision={revisionSupervisor}
            onAbrir={(cliente, pestana) => setModal({ cliente, pestana })}
          />
        ) : (
          <>
            <div className="min-w-0 space-y-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="min-w-0 flex-1">
                  <BuscadorCatalogo
                    valor={busqueda}
                    onCambio={(valor) => {
                      setBusqueda(valor);
                      lista.setPage(1);
                    }}
                    placeholder={
                      vista === "locales"
                        ? "Buscar local o código"
                        : "Buscar colaborador, usuario o código"
                    }
                    etiqueta={
                      vista === "locales"
                        ? "Buscar local en Administración"
                        : "Buscar colaborador en Administración"
                    }
                  />
                </div>
                {vista === "locales" && !lista.error && (
                  <span className="shrink-0 rounded-lg border border-line bg-surface-raised px-3 py-2 font-mono text-xs font-bold text-foreground">
                    {totalRegistros} {totalRegistros === 1 ? "local" : "locales"}
                  </span>
                )}
              </div>
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <div
                  role="radiogroup"
                  aria-label="Ver"
                  className="grid grid-cols-2 gap-1 rounded-xl bg-surface-soft p-1"
                >
                  {(
                    [
                      ["locales", "Locales"],
                      ["colaboradores", "Por colaborador"],
                    ] as const
                  ).map(([valor, texto]) => (
                    <button
                      key={valor}
                      type="button"
                      role="radio"
                      aria-checked={vista === valor}
                      onClick={() => setVista(valor)}
                      className={`min-h-10 cursor-pointer whitespace-nowrap rounded-lg px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                        vista === valor
                          ? "bg-surface-raised text-foreground shadow-xs"
                          : "text-muted hover:text-foreground"
                      }`}
                    >
                      {texto}
                    </button>
                  ))}
                </div>
                {vista === "locales" && (
                  <>
                    <div className="min-w-0 flex-1 sm:max-w-xs">
                      <SelectorPaginado
                        url="/campo/locales/colaboradores"
                        etiqueta="Colaborador"
                        placeholder="Todos los colaboradores"
                        buscable
                        compacto
                        value={colaborador?.id ?? ""}
                        seleccionActual={colaborador?.nombre}
                        onChange={(id) => {
                          if (id === "") setColaborador(null);
                          lista.setPage(1);
                        }}
                        onSeleccionar={(opcion) =>
                          setColaborador({
                            id: opcion.id,
                            nombre: opcion.nombre ?? `#${opcion.id}`,
                          })
                        }
                      />
                    </div>
                    <label className="sr-only" htmlFor="filtro-estado-locales">
                      Estado
                    </label>
                    <select
                      id="filtro-estado-locales"
                      value={estado}
                      onChange={(e) => {
                        setEstado(e.target.value as EstadoLocales);
                        lista.setPage(1);
                      }}
                      className="min-h-11 cursor-pointer rounded-lg border border-line bg-surface-raised px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-focus"
                    >
                      <option value="">Todos los estados</option>
                      <option value="sin-asignar">Sin asignar</option>
                      <option value="sin-ubicacion">Sin ubicación</option>
                    </select>
                    {(colaborador || estado) && (
                      <button
                        type="button"
                        onClick={() => {
                          setColaborador(null);
                          setEstado("");
                          lista.setPage(1);
                        }}
                        className="min-h-11 cursor-pointer whitespace-nowrap rounded-lg px-2 text-sm font-semibold text-muted underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                      >
                        Limpiar filtros
                      </button>
                    )}
                  </>
                )}
                <button
                  type="button"
                  onClick={() =>
                    setTraspaso({ origen: colaborador ?? undefined })
                  }
                  title="Pasar o intercambiar locales entre colaboradores"
                  className="ml-auto inline-flex min-h-11 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-brand-700 px-3 text-sm font-semibold text-brand-700 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus dark:border-brand-400 dark:text-brand-300 dark:hover:bg-brand-950/50"
                >
                  <span aria-hidden="true">⇄</span>
                  Intercambiar
                </button>
              </div>
            </div>

            {vista === "colaboradores" ? (
              <LocalesPorColaborador
                buscar={busqueda}
                onVer={(c) => {
                  setColaborador({ id: c.id, nombre: c.nombre });
                  setBusqueda("");
                  setVista("locales");
                  lista.setPage(1);
                }}
                onIntercambiar={(c) =>
                  setTraspaso({ origen: { id: c.id, nombre: c.nombre } })
                }
              />
            ) : (

            <div
              data-inicio-listado
              className="scroll-mt-20 rounded-xl border border-line bg-surface-raised shadow-xs overflow-hidden"
              style={{ borderColor: TOKENS.line }}
            >
              {lista.error ? (
                <div role="alert" className="space-y-3 px-4 py-12 text-center">
                  <p className="text-sm text-red-700 dark:text-red-300">
                    {lista.error}
                  </p>
                  <button
                    type="button"
                    onClick={lista.refrescar}
                    disabled={lista.cargando}
                    className="min-h-11 cursor-pointer rounded-lg border border-line px-4 text-sm font-semibold text-foreground hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-line dark:text-foreground dark:hover:bg-surface-soft"
                  >
                    Reintentar
                  </button>
                </div>
              ) : lista.cargando && !lista.items.length ? (
                <div className="py-16 text-center text-muted">
                  <div className="w-6 h-6 mx-auto border-2 border-foreground border-t-transparent rounded-full animate-spin mb-2.5" />
                  <p className="text-xs font-mono">Cargando itinerario…</p>
                </div>
              ) : lista.items.length === 0 ? (
                <div className="py-12 px-4 text-center">
                  <div className="w-10 h-10 mx-auto rounded-full bg-surface-soft flex items-center justify-center text-muted mb-2.5">
                    <IconoTienda className="w-5 h-5" />
                  </div>
                  <p className="text-sm font-bold text-foreground">
                    No se encontraron clientes
                  </p>
                  <p className="text-xs text-muted mt-1 max-w-sm mx-auto">
                    {busqueda
                      ? "Probá con otro nombre o código de cliente."
                      : "No hay locales disponibles para tu alcance."}
                  </p>
                </div>
              ) : (
                <>
                  <ul
                    className="grid gap-2.5 p-2.5 md:hidden"
                    aria-label="Locales de Administración"
                  >
                    {lista.items.map((local) => (
                      <li key={local.id} className="min-w-0">
                        <TarjetaPdv
                          local={local}
                          onInformacion={() =>
                            setModal({ cliente: local, pestana: "datos" })
                          }
                          onItinerario={() =>
                            setModal({ cliente: local, pestana: "horarios" })
                          }
                          onAsignacion={() =>
                            setModal({ cliente: local, pestana: "personal" })
                          }
                        />
                      </li>
                    ))}
                  </ul>
                  {/* Escritorio: los datos que más se consultan a la vista (dirección y
                      ubicación, contacto, equipo con su rol) y las acciones a la derecha. */}
                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-line bg-surface-soft text-[11px] font-bold uppercase tracking-wider text-muted">
                          <th className="py-2.5 px-3.5">Local</th>
                          <th className="py-2.5 px-3.5">Dirección</th>
                          <th className="hidden py-2.5 px-3.5 lg:table-cell">
                            Contacto
                          </th>
                          <th className="py-2.5 px-3.5">Equipo</th>
                          <th className="py-2.5 px-3.5 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line text-xs">
                        {lista.items.map((local) => (
                          <tr
                            key={local.id}
                            className="align-top transition-colors hover:bg-surface-soft"
                          >
                            <td className="min-w-[220px] px-3.5 py-3">
                              <div className="flex min-w-0 items-center gap-3">
                                <FotoLocal
                                  nombre={local.nombre}
                                  className="w-14 shrink-0"
                                />
                                <div className="min-w-0">
                                  <p className="text-sm font-bold leading-snug text-foreground">
                                    <TextoExpandible texto={local.nombre} />
                                  </p>
                                  <p className="mt-0.5 font-mono text-[11px] text-muted">
                                    {local.id}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="min-w-[200px] max-w-[320px] px-3.5 py-3">
                              {local.direccion ? (
                                <p className="text-xs text-foreground">
                                  <TextoExpandible texto={local.direccion} />
                                </p>
                              ) : (
                                <p className="text-xs text-muted">
                                  Sin dirección en CRD1
                                </p>
                              )}
                              {local.latitud === null ||
                              local.longitud === null ? (
                                <span className="mt-1 inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                                  <IconoAlerta className="h-3.5 w-3.5 shrink-0" />
                                  Sin ubicación cargada
                                </span>
                              ) : (
                                <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 dark:text-brand-300">
                                  <IconoPin className="h-3.5 w-3.5 shrink-0" />
                                  Ubicado · radio {local.radioMetros} m
                                </span>
                              )}
                            </td>
                            <td className="hidden whitespace-nowrap px-3.5 py-3 lg:table-cell">
                              <p className="font-mono text-[11px] text-muted">
                                RUC {local.ruc || "—"}
                              </p>
                              <p className="mt-0.5 text-xs text-foreground">
                                {local.telefono ? (
                                  formatearTelefono(local.telefono)
                                ) : (
                                  <span className="text-muted">Sin teléfono</span>
                                )}
                              </p>
                            </td>
                            <td className="min-w-[180px] max-w-[280px] px-3.5 py-3">
                              {local.asignaciones?.length ? (
                                <ul className="space-y-1" aria-label={`Equipo de ${local.nombre}`}>
                                  {local.asignaciones.map((asignacion) => (
                                    <li key={asignacion.id} className="min-w-0">
                                      <p className="truncate text-xs font-semibold text-foreground">
                                        {asignacion.usuario.nombre}{" "}
                                        {asignacion.usuario.apellido}
                                      </p>
                                      <p className="truncate text-[11px] text-muted">
                                        {asignacion.usuario.rol?.descripcion ??
                                          "Asignado"}
                                      </p>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300">
                                  Sin asignar
                                </span>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-3.5 py-3">
                              <div className="flex justify-end">
                                <AccionesItinerario
                                  nombre={local.nombre}
                                  onInformacion={() =>
                                    setModal({ cliente: local, pestana: "datos" })
                                  }
                                  onItinerario={() =>
                                    setModal({
                                      cliente: local,
                                      pestana: "horarios",
                                    })
                                  }
                                  onAsignacion={() =>
                                    setModal({
                                      cliente: local,
                                      pestana: "personal",
                                    })
                                  }
                                />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {!lista.error && totalRegistros > 0 && (
                <div className="flex justify-end border-t border-line bg-surface-soft px-4 pb-3 dark:border-line dark:bg-surface-soft">
                  <div className="w-full min-w-0 sm:w-auto">
                    <Paginacion
                      page={lista.page}
                      totalPages={lista.datos?.totalPages ?? 1}
                      total={totalRegistros}
                      limit={lista.limit}
                      onPageChange={lista.setPage}
                      onLimitChange={lista.setLimit}
                    />
                  </div>
                </div>
              )}
            </div>
            )}
          </>
        )}
      </main>

      {configVencimientos && (
        <ConfigVencimientosModal
          onCerrar={() => setConfigVencimientos(false)}
        />
      )}

      {traspaso && (
        <TraspasoLocalesModal
          origenInicial={traspaso.origen}
          onCerrar={() => setTraspaso(null)}
          onHecho={() => {
            setTraspaso(null);
            lista.refrescar();
            setRevisionMapa((valor) => valor + 1);
          }}
        />
      )}

      {modal && (
        <ClienteModal
          seccionUnica
          cliente={modal.cliente}
          pestana={modal.pestana}
          onCerrar={() => {
            if (modal.pestana === "horarios" || modal.pestana === "personal") {
              lista.refrescar();
              setRevisionSupervisor((valor) => valor + 1);
              setRevisionMapa((valor) => valor + 1);
            }
            setModal(null);
          }}
          onGuardado={(cliente) => {
            // Un alta nueva se busca por su código para verla en la lista.
            if (!modal.cliente) {
              setBusqueda(cliente.id);
              lista.setPage(1);
            }
            lista.refrescar();
            setRevisionSupervisor((valor) => valor + 1);
            setRevisionMapa((valor) => valor + 1);
          }}
        />
      )}
    </div>
  );
}
