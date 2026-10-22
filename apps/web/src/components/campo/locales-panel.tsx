"use client";

import React, { useMemo, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Paginacion } from "@/components/paginacion";
import { useListaCampo } from "@/hooks/use-lista-campo";
import { BotonEditar } from "@/components/boton-editar";
import { IconoMas } from "@/components/icono-mas";
import { ClienteModal, type PestanaCliente } from "./cliente-modal";
import { TOKENS } from "./tokens";
import { BuscadorCatalogo } from "./ui/filtros-catalogo";
import { TopBar } from "./ui/top-bar";
import { TarjetaPdv } from "./tarjeta-pdv";
import { FotoLocal } from "./ui/foto-local";
import { IconoTienda, IconoMapa, IconoPlanificacion } from "./ui/iconos-campo";
import type { ClientePdv } from "@/types/campo";

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
  const [mostrarMapaCobertura, setMostrarMapaCobertura] = useState(false);
  const [busqueda, setBusqueda] = useState("");
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
    const texto = busqueda.trim();
    return `/campo/locales${texto ? `?${new URLSearchParams({ buscar: texto })}` : ""}`;
  }, [busqueda]);

  const lista = useListaCampo<ClientePdv>(endpoint, 0, 7);
  const [revisionMapa, setRevisionMapa] = useState(0);

  const totalRegistros = lista.datos?.total ?? lista.items.length;

  return (
    <div
      className="campo-screen min-h-screen min-w-0 w-full text-[13px] font-sans pb-16"
      style={{ backgroundColor: TOKENS.bone, color: TOKENS.ink }}
    >
      <TopBar
        title="Puntos de Venta & Rutas"
        subtitle="Clientes con su ubicación, horarios y personal asignado"
        right={
          <>
            <button
              type="button"
              onClick={() => setModal({})}
              aria-label="Crear cliente"
              title="Crear cliente"
              className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-xl bg-brand-700 text-white transition hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:bg-brand-500 dark:text-zinc-950 dark:hover:bg-brand-400"
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
          </>
        }
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        {mostrarMapaCobertura && <MapaClientes key={revisionMapa} />}

        <div className="flex min-w-0 items-center gap-3">
          <div className="min-w-0 flex-1">
            <BuscadorCatalogo
              valor={busqueda}
              onCambio={(valor) => {
                setBusqueda(valor);
                lista.setPage(1);
              }}
              placeholder="Buscar por nombre o código de cliente…"
              etiqueta="Buscar punto de venta"
            />
          </div>
          {!lista.error && (
            <span className="shrink-0 rounded-lg border border-line bg-surface-raised px-3 py-2 font-mono text-xs font-bold text-foreground">
              {totalRegistros} locales
            </span>
          )}
        </div>

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
              <p className="text-xs font-mono">Cargando puntos de venta...</p>
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
                  : "Usá el botón + para crear un cliente y después asignarle visitas y tareas."}
              </p>
            </div>
          ) : (
            <>
              <ul
                className="grid gap-2.5 p-2.5 md:hidden"
                aria-label="Puntos de venta"
              >
                {lista.items.map((local) => (
                  <li key={local.id} className="min-w-0">
                    <TarjetaPdv
                      local={local}
                      onEditar={() => setModal({ cliente: local })}
                      onRuta={() =>
                        setModal({ cliente: local, pestana: "horarios" })
                      }
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
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line text-xs">
                    {lista.items.map((local) => (
                      <tr
                        key={local.id}
                        className="transition-colors hover:bg-surface-soft"
                      >
                        <td className="whitespace-nowrap px-3.5 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <BotonEditar
                              onClick={() => setModal({ cliente: local })}
                              etiqueta={`Editar cliente ${local.nombre}`}
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setModal({ cliente: local, pestana: "horarios" })
                              }
                              className="inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-md border border-line px-2.5 font-semibold text-foreground hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                            >
                              <IconoPlanificacion className="h-3.5 w-3.5" />
                              Ruta
                            </button>
                          </div>
                        </td>
                        <td className="min-w-[240px] px-3.5 py-2.5">
                          <div className="flex min-w-0 items-center gap-3">
                            <FotoLocal
                              nombre={local.nombre}
                              className="w-16 shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-foreground">
                                {local.nombre}
                              </p>
                              <p className="mt-0.5 break-words text-[11px] text-muted">
                                <span className="font-mono">{local.id}</span>
                                {local.direccion ? ` · ${local.direccion}` : ""}
                              </p>
                              {local.latitud === null && (
                                <p className="mt-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                                  Sin ubicación cargada
                                </p>
                              )}
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
      </main>

      {modal && (
        <ClienteModal
          cliente={modal.cliente}
          pestana={modal.pestana}
          onCerrar={() => setModal(null)}
          onGuardado={(cliente) => {
            // Un alta nueva se busca por su código para verla en la lista.
            if (!modal.cliente) {
              setBusqueda(cliente.id);
              lista.setPage(1);
            }
            lista.refrescar();
            setRevisionMapa((valor) => valor + 1);
          }}
        />
      )}

    </div>
  );
}
