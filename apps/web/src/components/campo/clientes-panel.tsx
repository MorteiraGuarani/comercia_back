"use client";

import React, { useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { volverAlInicioDelListado } from "@/utils/scroll-listado";
import { mensajeError } from "@/utils/error";
import { prepararImagen } from "@/utils/preparar-imagen";
import { CapturadorCamara } from "./capturador-camara";
import { IconoCamara, IconoGaleria } from "./ui/iconos-campo";
import { useListaCampo, useOperacionCampo } from "@/hooks/use-lista-campo";
import { Modal } from "@/components/modal";
import { PantallaCarga } from "@/components/pantalla-carga";
import { TOKENS } from "./tokens";
import { StatusStamp } from "./ui/status-stamp";
import { StatChip } from "./ui/stat-chip";
import { TopBar } from "./ui/top-bar";
import {
  IconoCliente,
  IconoMapa,
  IconoEditar,
  IconoBuscar,
  IconoCruz,
  IconoMas,
  IconoTelefono,
  IconoContacto,
  IconoTienda,
  IconoFlechaIzq,
  IconoFlechaDer,
} from "./ui/iconos-campo";
import type { ClienteCampo } from "@/types/campo";

export function ClientesPanel() {
  const router = useRouter();

  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<"todos" | "activos" | "inactivos">("todos");

  const endpoint = useMemo(() => {
    const params = new URLSearchParams();
    if (busqueda.trim()) params.set("buscar", busqueda.trim());
    const qs = params.toString();
    return `/campo/clientes${qs ? `?${qs}` : ""}`;
  }, [busqueda]);

  const lista = useListaCampo<ClienteCampo>(endpoint, 0, 25);
  const op = useOperacionCampo();
  const [form, setForm] = useState<ClienteCampo | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [subiendoLogo, setSubiendoLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [camaraAbierta, setCamaraAbierta] = useState(false);

  // Filtrado local por estado activo / inactivo
  const itemsFiltrados = useMemo(() => {
    return lista.items.filter((c) => {
      if (filtroEstado === "activos") return c.activo;
      if (filtroEstado === "inactivos") return !c.activo;
      return true;
    });
  }, [lista.items, filtroEstado]);

  const totalActivos = useMemo(() => lista.items.filter((c) => c.activo).length, [lista.items]);
  const totalInactivos = useMemo(() => lista.items.filter((c) => !c.activo).length, [lista.items]);

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
      if (file.type === "image/svg+xml") {
        if (file.size > 5 * 1024 * 1024) throw new Error("El SVG supera 5 MB.");
        formData.append("logo", file);
      } else {
        formData.append("logo", await prepararImagen(file));
      }

      const res = await apiFetch<{ url: string }>("/campo/clientes/subir-logo", {
        method: "POST",
        body: formData,
      });

      setForm((prev) => (prev ? { ...prev, logoUrl: res.url } : null));
    } catch (err) {
      alert("Error al subir imagen de logo: " + mensajeError(err, "Error inesperado"));
    } finally {
      setSubiendoLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const totalRegistros = lista.datos?.total ?? lista.items.length;
  const desde = totalRegistros > 0 ? (lista.page - 1) * lista.limit + 1 : 0;
  const hasta = Math.min(lista.page * lista.limit, totalRegistros);

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
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white shadow-sm transition-all hover:brightness-110 active:scale-95 cursor-pointer"
              style={{ backgroundColor: TOKENS.carne }}
            >
              <IconoMas className="w-4 h-4" />
            </button>
          </div>
        }
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        {/* KPI Chips Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
          <StatChip
            label="Total Clientes"
            value={totalRegistros}
            sub="Cuentas registradas"
            color="ink"
          />
          <StatChip
            label="Clientes Activos"
            value={totalActivos}
            sub="Con operaciones activas"
            color="fresco"
          />
          <StatChip
            label="Cuentas Inactivas"
            value={totalInactivos}
            sub="Pausadas u obsoletas"
            color="alerta"
          />
        </div>

        {/* VISTA 2: TABLA DE CLIENTES COMPACTA */}
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
                  placeholder="Buscar cliente por nombre comercial, contacto o RUC..."
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

              {/* Segmented Filter */}
              <div
                className="flex min-w-0 items-center gap-1 overflow-x-auto rounded-lg border bg-[#ECE9E2]/60 p-1 md:shrink-0"
                style={{ borderColor: TOKENS.line }}
              >
                {(["todos", "activos", "inactivos"] as const).map((filtro) => {
                  const activo = filtroEstado === filtro;
                  return (
                    <button
                      key={filtro}
                      type="button"
                      onClick={() => setFiltroEstado(filtro)}
                        className={`whitespace-nowrap rounded-md px-2 py-1.5 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer sm:px-3 ${
                        activo ? "bg-[#1E2320] text-white shadow-xs" : "text-[#726C60] hover:text-[#1E2320]"
                      }`}
                    >
                      {filtro}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tabla de Clientes */}
            <div
              data-inicio-listado
              className="scroll-mt-20 rounded-xl border bg-white shadow-xs overflow-hidden"
              style={{ borderColor: TOKENS.line }}
            >
              {lista.cargando && !lista.items.length ? (
                <div className="py-16 text-center text-zinc-500">
                  <div className="w-6 h-6 mx-auto border-2 border-[#1E2320] border-t-transparent rounded-full animate-spin mb-2.5" />
                  <p className="text-xs font-mono">Cargando catálogo de clientes...</p>
                </div>
              ) : itemsFiltrados.length === 0 ? (
                <div className="py-12 px-4 text-center">
                  <div className="w-10 h-10 mx-auto rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400 mb-2.5">
                    <IconoCliente className="w-5 h-5" />
                  </div>
                  <p className="text-sm font-bold text-[#1E2320]">No se encontraron clientes</p>
                  <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
                    {busqueda
                      ? "Prueba cambiando los términos de búsqueda."
                      : "Comienza registrando tu primera cuenta comercial o cliente."}
                  </p>
                  <button
                    type="button"
                    onClick={abrirCrear}
                    aria-label="Crear cliente"
                    title="Crear cliente"
                    className="mt-3.5 inline-grid h-11 w-11 place-items-center rounded-lg text-white"
                    style={{ backgroundColor: TOKENS.carne }}
                  >
                    <IconoMas className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <>
                <div className="grid gap-2 p-3 md:hidden">
                  {itemsFiltrados.map((cliente) => (
                    <article key={cliente.id} className="min-w-0 rounded-xl border border-line bg-surface-raised p-3 text-sm">
                      <div className="flex min-w-0 items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="break-words font-semibold text-foreground">{cliente.nombre}</h3>
                          <p className="text-xs text-muted">{cliente.ruc || "Sin RUC"} · {cliente._count?.locales ?? 0} locales</p>
                        </div>
                        <StatusStamp tone={cliente.activo ? "fresco" : "sub"} size="sm">{cliente.activo ? "ACTIVO" : "INACTIVO"}</StatusStamp>
                      </div>
                      {cliente.contacto && <p className="mt-2 break-words text-xs text-muted">Contacto: {cliente.contacto}</p>}
                      {cliente.telefono && <a href={`tel:${cliente.telefono}`} className="mt-1 inline-flex min-h-11 items-center text-xs font-semibold text-sky-700">{cliente.telefono}</a>}
                      <div className="mt-2 flex gap-2">
                        <button type="button" onClick={() => verEnMapa(cliente.id)} className="min-h-11 flex-1 rounded-lg border border-line px-3 text-xs font-semibold text-foreground">Ver mapa</button>
                        <button type="button" onClick={() => setForm(cliente)} className="min-h-11 flex-1 rounded-lg border border-line px-3 text-xs font-semibold text-foreground">Editar</button>
                      </div>
                    </article>
                  ))}
                </div>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b bg-zinc-50/80 text-[11px] font-bold uppercase tracking-wider text-zinc-500" style={{ borderColor: TOKENS.line }}>
                        <th className="py-2.5 px-3.5">Cliente / Empresa</th>
                        <th className="py-2.5 px-3.5">RUC</th>
                        <th className="py-2.5 px-3.5">Contacto Principal</th>
                        <th className="py-2.5 px-3.5">Teléfono</th>
                        <th className="py-2.5 px-3.5 text-center">Puntos de Venta</th>
                        <th className="py-2.5 px-3.5 text-center">Estado</th>
                        <th className="py-2.5 px-3.5 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 text-xs">
                      {itemsFiltrados.map((cliente) => {
                        const localesCount = cliente._count?.locales ?? 0;
                        return (
                          <tr
                            key={cliente.id}
                            className="hover:bg-zinc-50/70 transition-colors group"
                          >
                            {/* Cliente / Empresa */}
                            <td className="py-2.5 px-3.5">
                              <div className="flex items-center gap-2.5 min-w-0 max-w-[260px]">
                                {cliente.logoUrl ? (
                                  <img
                                    src={cliente.logoUrl}
                                    alt={cliente.nombre}
                                    className="w-8 h-8 rounded-lg object-cover border border-zinc-200 shrink-0 bg-zinc-50"
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded-lg bg-[#1E2320] text-white font-bold text-xs flex items-center justify-center shrink-0">
                                    {iniciales(cliente.nombre)}
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <p className="font-bold text-zinc-900 truncate leading-tight">
                                    {cliente.nombre}
                                  </p>
                                </div>
                              </div>
                            </td>

                            {/* RUC */}
                            <td className="py-2.5 px-3.5 whitespace-nowrap">
                              {cliente.ruc ? (
                                <span className="font-mono text-xs text-zinc-700 bg-zinc-100 px-2 py-0.5 rounded font-semibold">
                                  {cliente.ruc}
                                </span>
                              ) : (
                                <span className="text-zinc-400 italic text-[11px]">Sin RUC</span>
                              )}
                            </td>

                            {/* Contacto */}
                            <td className="py-2.5 px-3.5">
                              <div className="flex items-center gap-1.5 min-w-0 max-w-[180px]">
                                <IconoContacto className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                                <span className="truncate font-medium text-zinc-800">
                                  {cliente.contacto || "—"}
                                </span>
                              </div>
                            </td>

                            {/* Teléfono */}
                            <td className="py-2.5 px-3.5 whitespace-nowrap">
                              {cliente.telefono ? (
                                <a
                                  href={`tel:${cliente.telefono}`}
                                  className="inline-flex items-center gap-1 font-mono text-xs text-[#2C4A6E] font-bold hover:underline"
                                >
                                  <IconoTelefono className="w-3 h-3 text-zinc-400" />
                                  <span>{cliente.telefono}</span>
                                </a>
                              ) : (
                                <span className="text-[11px] text-zinc-400">Sin teléfono</span>
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
                              <StatusStamp tone={cliente.activo ? "fresco" : "sub"} size="sm">
                                {cliente.activo ? "ACTIVO" : "INACTIVO"}
                              </StatusStamp>
                            </td>

                            {/* Acciones */}
                            <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => verEnMapa(cliente.id)}
                                  title="Ver locales de este cliente en el mapa de cobertura"
                                  className="px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider text-[#2C4A6E] bg-sky-50 hover:bg-sky-100 transition-colors inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <IconoMapa className="w-3 h-3" />
                                  <span>Mapa</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setForm(cliente)}
                                  title="Editar cliente"
                                  className="p-1 rounded-md text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer"
                                >
                                  <IconoEditar className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
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
                      <strong className="text-zinc-800">{totalRegistros}</strong> clientes
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
            <div className="p-3 rounded-xl border bg-zinc-50 flex items-center gap-3.5" style={{ borderColor: TOKENS.line }}>
              {/* Preview del Logo */}
              <div className="relative w-14 h-14 rounded-xl overflow-hidden border border-zinc-200 shadow-xs bg-white shrink-0 flex items-center justify-center">
                {form.logoUrl ? (
                  <img src={form.logoUrl} alt="Logo preview" className="w-full h-full object-cover" />
                ) : (
                  <span className="font-bold text-base text-zinc-400">
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
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
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
                      className="px-2 py-1 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 transition cursor-pointer"
                    >
                      Quitar
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-zinc-500 mt-1 font-medium">
                  Las fotos se reducen antes de subir. SVG hasta 5 MB.
                </p>
              </div>
            </div>

            {/* Nombre Comercial */}
            <div>
              <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                Nombre de la Empresa / Cliente *
              </label>
              <input
                type="text"
                required
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Ej. Frigorífico Guaraní, Superseis, etc."
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border bg-white focus:outline-none focus:ring-2 focus:ring-[#1E2320] font-medium"
                style={{ borderColor: TOKENS.line }}
              />
            </div>

            {/* RUC */}
            <div>
              <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                RUC / Identificación Fiscal
              </label>
              <input
                type="text"
                value={form.ruc}
                onChange={(e) => setForm({ ...form, ruc: e.target.value })}
                placeholder="Ej. 80012345-6"
                className="w-full px-3 py-2 font-mono text-xs sm:text-sm font-medium rounded-lg border bg-white focus:outline-none focus:ring-2 focus:ring-[#1E2320]"
                style={{ borderColor: TOKENS.line }}
              />
            </div>

            {/* Contacto y Teléfono */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                  Persona de Contacto
                </label>
                <input
                  type="text"
                  value={form.contacto}
                  onChange={(e) => setForm({ ...form, contacto: e.target.value })}
                  placeholder="Ej. Juan Pérez"
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border bg-white focus:outline-none focus:ring-2 focus:ring-[#1E2320] font-medium"
                  style={{ borderColor: TOKENS.line }}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                  Teléfono Comercial
                </label>
                <input
                  type="text"
                  value={form.telefono}
                  onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                  placeholder="Ej. +595 21 123 456"
                  className="w-full px-3 py-2 font-mono text-xs sm:text-sm font-medium rounded-lg border bg-white focus:outline-none focus:ring-2 focus:ring-[#1E2320]"
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
                className="w-4 h-4 rounded border-zinc-300 text-[#1E2320] focus:ring-[#1E2320] cursor-pointer"
              />
              <label htmlFor="cliente-activo-check" className="text-xs font-semibold text-zinc-800 cursor-pointer">
                Cuenta comercial activa (disponible para asignaciones de ruta)
              </label>
            </div>

            {/* Mensajes de error */}
            {op.error && <p className="text-xs text-red-600 font-bold">{op.error}</p>}

            {/* Botones de acción */}
            <div className="flex justify-end gap-2.5 pt-3 border-t" style={{ borderColor: TOKENS.line }}>
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
                disabled={guardando}
                className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider text-white shadow-sm cursor-pointer disabled:opacity-50"
                style={{ backgroundColor: TOKENS.carne }}
              >
                {guardando ? "Guardando..." : form.id ? "Guardar Cambios" : "Crear Cliente"}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <PantallaCarga visible={guardando || subiendoLogo} mensaje={subiendoLogo ? "Subiendo foto del cliente" : "Procesando operación comercial..."} />
    </div>
  );
}
