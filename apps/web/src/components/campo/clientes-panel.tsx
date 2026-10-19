"use client";

import React, { useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Paginacion } from "@/components/paginacion";
import { mensajeError } from "@/utils/error";
import { prepararImagen } from "@/utils/preparar-imagen";
import { CapturadorCamara } from "./capturador-camara";
import { IconoCamara, IconoGaleria } from "./ui/iconos-campo";
import { useListaCampo, useOperacionCampo } from "@/hooks/use-lista-campo";
import { Modal } from "@/components/modal";
import { BotonEditar } from "@/components/boton-editar";
import { BotonEliminarCampo } from "./boton-eliminar-campo";
import { ConfirmarEliminacionCampo } from "./confirmar-eliminacion-campo";
import { PantallaCarga } from "@/components/pantalla-carga";
import { TOKENS } from "./tokens";
import { BuscadorCatalogo, KpisFiltro } from "./ui/filtros-catalogo";
import { LogoCliente } from "./ui/logo-cliente";
import { TopBar } from "./ui/top-bar";
import {
  IconoCliente,
  IconoMapa,
  IconoCheck,
  IconoCruz,
  IconoMas,
  IconoTienda,
} from "./ui/iconos-campo";
import type { ClienteCampo, RespuestaClientesCampo } from "@/types/campo";
import { mostrarToast } from "@/components/toast/toast-controller";

export function ClientesPanel() {
  const router = useRouter();

  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<"todos" | "activos" | "inactivos">("todos");

  const endpoint = useMemo(() => {
    const params = new URLSearchParams();
    if (busqueda.trim()) params.set("buscar", busqueda.trim());
    params.set("estado", filtroEstado);
    params.set("conResumen", "1");
    const qs = params.toString();
    return `/campo/clientes${qs ? `?${qs}` : ""}`;
  }, [busqueda, filtroEstado]);

  const lista = useListaCampo<ClienteCampo>(endpoint, 0, 7);
  const op = useOperacionCampo();
  const [form, setForm] = useState<ClienteCampo | null>(null);
  const [eliminando, setEliminando] = useState<ClienteCampo | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [subiendoLogo, setSubiendoLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [camaraAbierta, setCamaraAbierta] = useState(false);

  const itemsFiltrados = lista.items;

  // Contadores reales de la API (no solo de la página visible).
  const resumen = (lista.datos as RespuestaClientesCampo | null)?.resumen;

  const abrirCrear = () => {
    setForm({
      id: 0,
      nombre: "",
      ruc: "",
      contacto: "",
      telefono: "",
      logoUrl: null,
      activo: true,
    });
  };

  const verEnMapa = (clienteId: number) => {
    router.push(`/panel/gestion-campo/locales?mapa=1&clienteId=${clienteId}`);
  };

  function abrirEliminar(cliente: ClienteCampo) {
    op.limpiarError();
    setEliminando(cliente);
  }

  async function eliminar(eliminarLocales: boolean) {
    if (!eliminando) return;
    const ok = await op.ejecutar("Eliminando cliente", () =>
      apiFetch(`/campo/clientes/${eliminando.id}`, {
        method: "DELETE", body: JSON.stringify({ eliminarLocales }),
      }),
    );
    if (ok) {
      setEliminando(null);
      lista.refrescar();
    }
  }

  const iniciales = (nombre: string) => {
    return (
      nombre
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase() || "CL"
    );
  };

  // Manejar subida de archivo de logo
  const subirLogo = async (file: File) => {
    if (!file || !form) return;

    try {
      setSubiendoLogo(true);
      const formData = new FormData();
      // También los SVG: la API solo acepta JPG, PNG o WebP.
      formData.append("logo", await prepararImagen(file));

      const res = await apiFetch<{ url: string }>("/campo/clientes/subir-logo", {
        method: "POST",
        body: formData,
      });

      setForm((prev) => (prev ? { ...prev, logoUrl: res.url } : null));
    } catch (err) {
      mostrarToast("error", mensajeError(err, "Error inesperado"), "No se pudo subir el logo");
    } finally {
      setSubiendoLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const totalRegistros = lista.datos?.total ?? lista.items.length;

  return (
    <div
      className="campo-screen min-h-screen min-w-0 w-full text-[13px] font-sans pb-16"
      style={{ backgroundColor: TOKENS.bone, color: TOKENS.ink }}
    >
      {camaraAbierta && <CapturadorCamara onCapturar={(archivo) => void subirLogo(archivo)} onCerrar={() => setCamaraAbierta(false)} />}
      <TopBar
        title="Catálogo de Clientes"
        subtitle="Empresas y cuentas comerciales con gestión de logos"
        right={
            <div className="flex max-w-full flex-wrap items-center gap-2">
            {/* Botón Crear Cliente */}
            <button
              type="button"
              onClick={abrirCrear}
              aria-label="Crear cliente"
              title="Crear cliente"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white dark:text-[#3b1219] shadow-sm transition-all hover:brightness-110 active:scale-95 cursor-pointer"
              style={{ backgroundColor: TOKENS.carne }}
            >
              <IconoMas className="w-4 h-4" />
            </button>
          </div>
        }
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        {/* Indicadores que filtran: reemplazan las pestañas de estado */}
        <KpisFiltro
          etiqueta="Filtrar clientes"
          seleccionado={filtroEstado}
          onSeleccionar={(clave) => {
            setFiltroEstado(clave);
            lista.setPage(1);
          }}
          items={[
            { clave: "todos", etiqueta: "Clientes", valor: resumen?.total ?? "—", detalle: "Cuentas registradas", icono: <IconoCliente />, tono: "marca" },
            { clave: "activos", etiqueta: "Activos", valor: resumen?.activos ?? "—", detalle: "Con operación vigente", icono: <IconoCheck />, tono: "verde" },
            { clave: "inactivos", etiqueta: "Inactivos", valor: resumen?.inactivos ?? "—", detalle: "Pausados u obsoletos", icono: <IconoCruz />, tono: "gris" },
          ]}
        />

        <BuscadorCatalogo
          valor={busqueda}
          onCambio={(valor) => {
            setBusqueda(valor);
            lista.setPage(1);
          }}
          placeholder="Buscar por nombre, contacto o RUC"
          etiqueta="Buscar cliente"
        />

            {/* Tabla de Clientes */}
            <div
              data-inicio-listado
              className="scroll-mt-20 rounded-xl border border-line bg-surface-raised shadow-xs overflow-hidden"
              style={{ borderColor: TOKENS.line }}
            >
              {lista.cargando && !lista.items.length ? (
                <div className="py-16 text-center text-muted">
                  <div className="w-6 h-6 mx-auto border-2 border-foreground border-t-transparent rounded-full animate-spin mb-2.5" />
                  <p className="text-xs font-mono">Cargando catálogo de clientes...</p>
                </div>
              ) : itemsFiltrados.length === 0 ? (
                <div className="py-12 px-4 text-center">
                  <div className="w-10 h-10 mx-auto rounded-full bg-surface-soft flex items-center justify-center text-muted mb-2.5">
                    <IconoCliente className="w-5 h-5" />
                  </div>
                  <p className="text-sm font-bold text-foreground">No se encontraron clientes</p>
                  <p className="text-xs text-muted mt-1 max-w-sm mx-auto">
                    {busqueda
                      ? "Prueba cambiando los términos de búsqueda."
                      : "Comienza registrando tu primera cuenta comercial o cliente."}
                  </p>
                  <button
                    type="button"
                    onClick={abrirCrear}
                    aria-label="Crear cliente"
                    title="Crear cliente"
                    className="mt-3.5 inline-grid h-11 w-11 place-items-center rounded-lg text-white dark:text-[#3b1219]"
                    style={{ backgroundColor: TOKENS.carne }}
                  >
                    <IconoMas className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <>
                <ul aria-label="Clientes" className="grid gap-2.5 p-2.5 md:hidden">
                  {itemsFiltrados.map((cliente) => (
                    <li key={cliente.id} className="min-w-0">
                      <article className="relative overflow-hidden rounded-xl border border-line bg-surface-raised shadow-[0_2px_8px_rgba(var(--warm-shadow),0.06)]">
                        <span
                          aria-hidden="true"
                          className={`absolute inset-y-0 left-0 w-1 ${cliente.activo ? "bg-emerald-600 dark:bg-emerald-400" : "bg-stone-400 dark:bg-stone-500"}`}
                        />
                        <div className="p-3 pl-4">
                          <div className="flex min-w-0 items-start gap-3">
                            <LogoCliente nombre={cliente.nombre} logoUrl={cliente.logoUrl} className="h-14 w-14" />
                            <div className="min-w-0 flex-1">
                              <div className="flex min-w-0 items-start justify-between gap-2">
                                <h3 className="min-w-0 break-words text-sm font-bold leading-snug text-foreground">{cliente.nombre}</h3>
                                <span
                                  className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                                    cliente.activo
                                      ? "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                      : "border-stone-300 bg-stone-100 text-stone-700 dark:border-stone-700 dark:bg-stone-800/70 dark:text-stone-200"
                                  }`}
                                >
                                  {cliente.activo ? "Activo" : "Inactivo"}
                                </span>
                              </div>
                              {cliente.contacto || cliente.telefono ? (
                                <p className="truncate text-xs text-muted">{[cliente.contacto, cliente.telefono].filter(Boolean).join(" · ")}</p>
                              ) : null}
                              <div className="mt-1.5 flex flex-wrap gap-1.5">
                                <span className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-800 dark:border-brand-800 dark:bg-brand-950/50 dark:text-brand-100">
                                  <IconoTienda className="h-3 w-3" />
                                  {cliente._count?.locales ?? 0} {(cliente._count?.locales ?? 0) === 1 ? "local" : "locales"}
                                </span>
                                <span className="inline-flex items-center rounded-full border border-line bg-surface-soft px-2 py-0.5 font-mono text-[11px] text-foreground">
                                  {cliente.ruc || "Sin RUC"}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="mt-3 flex items-center gap-2 border-t border-line/70 pt-2.5">
                            <BotonEditar onClick={() => setForm(cliente)} etiqueta={`Editar cliente ${cliente.nombre}`} modo="texto" className="flex-1" />
                            <button
                              type="button"
                              onClick={() => verEnMapa(cliente.id)}
                              className="inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-sky-200 bg-sky-50 px-3 text-sm font-semibold text-sky-800 transition-colors hover:border-sky-400 dark:hover:border-sky-700 hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-200 dark:hover:bg-sky-900"
                            >
                              <IconoMapa className="h-4 w-4" />
                              Mapa
                            </button>
                            <BotonEliminarCampo onClick={() => abrirEliminar(cliente)} etiqueta={`Eliminar cliente ${cliente.nombre}`} disabled={!!op.mensaje} />
                          </div>
                        </div>
                      </article>
                    </li>
                  ))}
                </ul>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b bg-surface-soft text-[11px] font-bold uppercase tracking-wider text-muted" style={{ borderColor: TOKENS.line }}>
                        <th className="py-2.5 px-3.5">Acciones</th>
                        <th className="py-2.5 px-3.5">Cliente</th>
                        <th className="py-2.5 px-3.5">RUC</th>
                        <th className="py-2.5 px-3.5 text-center">Puntos de Venta</th>
                        <th className="py-2.5 px-3.5 text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line text-xs">
                      {itemsFiltrados.map((cliente) => {
                        const localesCount = cliente._count?.locales ?? 0;
                        return (
                          <tr
                            key={cliente.id}
                            className="hover:bg-surface-soft transition-colors group"
                          >
                            {/* Acciones */}
                            <td className="py-2.5 px-3.5 whitespace-nowrap">
                              <div className="inline-flex items-center gap-1.5">
                                <BotonEditar onClick={() => setForm(cliente)} etiqueta={`Editar cliente ${cliente.nombre}`} />
                                <button
                                  type="button"
                                  onClick={() => verEnMapa(cliente.id)}
                                  title="Ver locales de este cliente en el mapa de cobertura"
                                  className="px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider text-[#2C4A6E] dark:text-[#a0bddf] bg-sky-50 dark:bg-sky-950/50 hover:bg-sky-100 dark:hover:bg-sky-900 transition-colors inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <IconoMapa className="w-3 h-3" />
                                  <span>Mapa</span>
                                </button>
                                <BotonEliminarCampo onClick={() => abrirEliminar(cliente)} etiqueta={`Eliminar cliente ${cliente.nombre}`} disabled={!!op.mensaje} />
                              </div>
                            </td>

                            {/* Cliente */}
                            <td className="py-2.5 px-3.5">
                              <div className="flex items-center gap-2.5 min-w-0 max-w-[260px]">
                                <LogoCliente nombre={cliente.nombre} logoUrl={cliente.logoUrl} className="h-11 w-11" />
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-bold leading-tight text-foreground">
                                    {cliente.nombre}
                                  </p>
                                </div>
                              </div>
                            </td>

                            {/* RUC */}
                            <td className="py-2.5 px-3.5 whitespace-nowrap">
                              {cliente.ruc ? (
                                <span className="font-mono text-xs text-foreground bg-surface-soft px-2 py-0.5 rounded font-semibold">
                                  {cliente.ruc}
                                </span>
                              ) : (
                                <span className="text-muted italic text-[11px]">Sin RUC</span>
                              )}
                            </td>

                            {/* Puntos de Venta (Locales) */}
                            <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                              <span className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-soft px-2 py-0.5 text-[11px] font-bold text-foreground">
                                <IconoTienda className="h-2.5 w-2.5 text-muted" />
                                <span>{localesCount}</span>
                              </span>
                            </td>

                            {/* Estado */}
                            <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                              <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-bold ${cliente.activo ? "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300" : "border-stone-300 bg-stone-100 text-stone-700 dark:border-stone-700 dark:bg-stone-800/70 dark:text-stone-200"}`}>
                                {cliente.activo ? "Activo" : "Inactivo"}
                              </span>
                            </td>

                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                </>
              )}

              <Paginacion page={lista.page} totalPages={lista.datos?.totalPages ?? 1} total={totalRegistros} limit={lista.limit} onPageChange={lista.setPage} onLimitChange={lista.setLimit} />
            </div>
      </main>

      {/* Modal de Creación / Edición con Subida de Logo */}
      <Modal
        titulo={form?.id ? `Editar Cliente · ${form.nombre}` : "Registrar Nuevo Cliente"}
        abierto={!!form}
        onCerrar={() => {
          if (!op.mensaje) setForm(null);
        }}
        ancho="md"
      >
        {form && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setGuardando(true);
              try {
                await op.ejecutar(
                  form.id ? "Cliente actualizado exitosamente" : "Cliente creado exitosamente",
                  async () => {
                    await apiFetch(form.id ? `/campo/clientes/${form.id}` : "/campo/clientes", {
                      method: form.id ? "PUT" : "POST",
                      body: JSON.stringify({
                        nombre: form.nombre,
                        ruc: form.ruc,
                        contacto: form.contacto,
                        telefono: form.telefono,
                        logoUrl: form.logoUrl,
                        activo: form.activo,
                      }),
                    });
                    lista.refrescar();
                    setForm(null);
                  },
                );
              } finally {
                setGuardando(false);
              }
            }}
            className="space-y-4 pt-1"
          >
            {/* Sección de Foto / Logo del Cliente */}
            <div className="p-3 rounded-xl border bg-surface-soft flex items-center gap-3.5" style={{ borderColor: TOKENS.line }}>
              {/* Preview del Logo */}
              <div className="relative w-14 h-14 rounded-xl overflow-hidden border border-line shadow-xs bg-surface-raised shrink-0 flex items-center justify-center">
                {form.logoUrl ? (
                  <img src={form.logoUrl} alt="Vista previa del logo" className="w-full h-full object-cover" />
                ) : (
                  <span className="font-bold text-base text-muted">
                    {iniciales(form.nombre || "CL")}
                  </span>
                )}
                {subiendoLogo && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>

              {/* Botones para subir imagen */}
              <div className="flex-1 min-w-0">
                <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-1">
                  Logo / Foto del Cliente
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={(evento) => { const archivo = evento.target.files?.[0]; if (archivo) void subirLogo(archivo); }}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={subiendoLogo}
                    aria-label="Elegir logo de la galería"
                    title="Galería"
                    className="grid h-11 w-11 place-items-center rounded-lg border border-line bg-surface-raised text-foreground hover:bg-surface-soft focus-visible:ring-2 focus-visible:ring-brand-600 disabled:opacity-50"
                    style={{ borderColor: TOKENS.line }}
                  >
                    <IconoGaleria className="h-5 w-5" />
                  </button>
                  <button type="button" onClick={() => setCamaraAbierta(true)} disabled={subiendoLogo} aria-label="Tomar foto del cliente con la cámara" title="Cámara" className="grid h-11 w-11 place-items-center rounded-lg border border-line bg-surface-raised text-foreground hover:bg-surface-soft focus-visible:ring-2 focus-visible:ring-brand-600 disabled:opacity-50"><IconoCamara className="h-5 w-5" /></button>

                  {form.logoUrl && (
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, logoUrl: null })}
                      className="px-2 py-1 rounded-lg text-xs font-semibold text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950 transition cursor-pointer"
                    >
                      Quitar
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-muted mt-1 font-medium">
                  Las fotos se reducen antes de subir. SVG hasta 5 MB.
                </p>
              </div>
            </div>

            {/* Nombre Comercial */}
            <div>
              <label className="block text-[11px] font-bold text-foreground uppercase tracking-wider mb-1">
                Nombre de la Empresa / Cliente *
              </label>
              <input
                type="text"
                required
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Ej. Frigorífico Guaraní, Superseis, etc."
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border bg-surface-raised focus:outline-none focus:ring-2 focus:ring-focus font-medium"
                style={{ borderColor: TOKENS.line }}
              />
            </div>

            {/* RUC */}
            <div>
              <label className="block text-[11px] font-bold text-foreground uppercase tracking-wider mb-1">
                RUC / Identificación Fiscal
              </label>
              <input
                type="text"
                value={form.ruc}
                onChange={(e) => setForm({ ...form, ruc: e.target.value })}
                placeholder="Ej. 80012345-6"
                className="w-full px-3 py-2 font-mono text-xs sm:text-sm font-medium rounded-lg border bg-surface-raised focus:outline-none focus:ring-2 focus:ring-focus"
                style={{ borderColor: TOKENS.line }}
              />
            </div>

            {/* Contacto y Teléfono */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-foreground uppercase tracking-wider mb-1">
                  Persona de Contacto
                </label>
                <input
                  type="text"
                  value={form.contacto}
                  onChange={(e) => setForm({ ...form, contacto: e.target.value })}
                  placeholder="Ej. Juan Pérez"
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border bg-surface-raised focus:outline-none focus:ring-2 focus:ring-focus font-medium"
                  style={{ borderColor: TOKENS.line }}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-foreground uppercase tracking-wider mb-1">
                  Teléfono Comercial
                </label>
                <input
                  type="text"
                  value={form.telefono}
                  onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                  placeholder="Ej. +595 21 123 456"
                  className="w-full px-3 py-2 font-mono text-xs sm:text-sm font-medium rounded-lg border bg-surface-raised focus:outline-none focus:ring-2 focus:ring-focus"
                  style={{ borderColor: TOKENS.line }}
                />
              </div>
            </div>

            {/* Checkbox Activo */}
            <div className="pt-1 flex items-center gap-2.5">
              <input
                type="checkbox"
                id="cliente-activo-check"
                checked={form.activo}
                onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                className="w-4 h-4 rounded border-zinc-300 text-foreground focus:ring-focus cursor-pointer"
              />
              <label htmlFor="cliente-activo-check" className="text-xs font-semibold text-foreground cursor-pointer">
                Cuenta comercial activa (disponible para asignaciones de ruta)
              </label>
            </div>

            {/* Mensajes de error */}
            {op.error && <p className="text-xs text-red-600 dark:text-red-300 font-bold">{op.error}</p>}

            {/* Botones de acción */}
            <div className="flex justify-end gap-2.5 pt-3 border-t" style={{ borderColor: TOKENS.line }}>
              <button
                type="button"
                onClick={() => setForm(null)}
                className="px-4 py-2 rounded-lg border text-xs font-bold uppercase tracking-wider bg-surface-raised hover:bg-surface-soft cursor-pointer"
                style={{ borderColor: TOKENS.line }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardando}
                className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider text-white dark:text-[#3b1219] shadow-sm cursor-pointer disabled:opacity-50"
                style={{ backgroundColor: TOKENS.carne }}
              >
                {guardando ? "Guardando..." : form.id ? "Guardar Cambios" : "Crear Cliente"}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {eliminando && <ConfirmarEliminacionCampo tipo="cliente" nombre={eliminando.nombre} cantidadLocales={eliminando._count?.locales ?? 0} procesando={!!op.mensaje} error={op.error} onCerrar={() => setEliminando(null)} onConfirmar={(borrarLocales) => void eliminar(borrarLocales)} />}
      <PantallaCarga visible={guardando || subiendoLogo || !!op.mensaje} mensaje={subiendoLogo ? "Subiendo foto del cliente" : op.mensaje || "Procesando operación comercial..."} />
    </div>
  );
}
