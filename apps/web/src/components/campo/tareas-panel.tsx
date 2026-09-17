"use client";

import React, { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { useListaCampo, useOperacionCampo } from "@/hooks/use-lista-campo";
import { fechaEnZonaIso } from "@/utils/fechas";
import { Modal } from "@/components/modal";
import { PantallaCarga } from "@/components/pantalla-carga";
import { Paginacion } from "@/components/paginacion";
import { IconoMas } from "@/components/icono-mas";
import { TOKENS } from "./tokens";
import { StatusStamp } from "./ui/status-stamp";
import { StatChip } from "./ui/stat-chip";
import { TopBar } from "./ui/top-bar";
import {
  IconoBuscar,
  IconoCruz,
  IconoEditar,
  IconoCamara,
  IconoGlobo,
  IconoPin,
} from "./ui/iconos-campo";
import type { FormTareaCampo, TareaCampo, LocalCampo, RespuestaCatalogoTareasCampo } from "@/types/campo";

const CATEGORIAS_PRESET = [
  "Góndola",
  "Limpieza",
  "Precios",
  "Exhibición",
  "Vencimientos",
  "Relevamiento",
  "Control de Stock",
];

export function TareasPanel() {
  const op = useOperacionCampo();

  const [busqueda, setBusqueda] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>("Todas");
  const [filtroTipo, setFiltroTipo] = useState<"todas" | "obligatorias" | "con_fotos">("todas");
  const [buscar, setBuscar] = useState("");
  const parametros = new URLSearchParams({ buscar });
  if (categoriaFiltro !== "Todas") parametros.set("categoria", categoriaFiltro);
  if (filtroTipo !== "todas") parametros.set("tipo", filtroTipo);
  const lista = useListaCampo<TareaCampo>(`/campo/tareas?${parametros}`, 0, 7);
  const resumen = (lista.datos as RespuestaCatalogoTareasCampo | null)?.resumen;
  const { setPage } = lista;

  useEffect(() => {
    const timer = setTimeout(() => { setBuscar(busqueda.trim()); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [busqueda, setPage]);

  const [id, setId] = useState(0);
  const [form, setForm] = useState<FormTareaCampo | null>(null);
  const [categoriaPersonalizada, setCategoriaPersonalizada] = useState(false);

  // Lista de locales para selector
  const [localesDisponibles, setLocalesDisponibles] = useState<LocalCampo[]>([]);
  const [busquedaLocal, setBusquedaLocal] = useState("");

  useEffect(() => {
    apiFetch<{ items: LocalCampo[] }>("/campo/locales?limit=100")
      .then((res) => setLocalesDisponibles(res.items || []))
      .catch(() => undefined);
  }, []);

  function abrir(t?: TareaCampo) {
    setId(t?.id ?? 0);
    op.limpiarError();

    const cat = t?.categoria || "Góndola";
    const esPreset = CATEGORIAS_PRESET.includes(cat);
    setCategoriaPersonalizada(!esPreset);

    setForm({
      nombre: t?.nombre ?? "",
      descripcion: t?.descripcion ?? "",
      categoria: cat,
      esObligatoria: t?.esObligatoria ?? false,
      estado: t?.estado ?? "ABIERTA",
      todosLocales: t?.todosLocales ?? true,
      activo: t?.activo ?? true,
      fechaDesde: t?.fechaDesde.slice(0, 10) ?? fechaEnZonaIso(new Date()),
      fechaHasta: t?.fechaHasta?.slice(0, 10) ?? "",
      localIds: t?.locales.map((x) => x.local.id) ?? [],
      requiereFotos: t?.requiereFotos ?? false,
      fotosObligatorias: t?.fotosObligatorias ?? false,
    });
  }

  return (
    <div
      className="campo-screen min-w-0 w-full min-h-screen text-[13px] font-sans pb-16"
      style={{ backgroundColor: TOKENS.bone, color: TOKENS.ink }}
    >
      <TopBar
        title="Catálogo de Tareas"
        subtitle="Repositorio de tareas operativas y protocolos para el equipo en calle"
        right={
          <button
            type="button"
            onClick={() => abrir()}
            aria-label="Crear tarea"
            title="Crear tarea"
            className="grid h-11 w-11 place-items-center rounded-lg text-white transition-colors hover:brightness-110"
            style={{ backgroundColor: TOKENS.carne }}
          >
            <IconoMas className="w-4 h-4" />
          </button>
        }
      />

      <main className="max-w-7xl min-w-0 mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-3 sm:space-y-5">
        {/* Filtros por Categoría */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
          {["Todas", ...CATEGORIAS_PRESET].map((cat) => {
            const activo = categoriaFiltro === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => { setCategoriaFiltro(cat); lista.setPage(1); }}
                aria-pressed={activo}
                className={`min-h-11 px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
                  activo
                    ? "bg-foreground text-background"
                    : "bg-surface-raised text-muted hover:text-foreground border"
                }`}
                style={{ borderColor: activo ? "transparent" : TOKENS.line }}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* KPI Chips: una tira compacta en móvil */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 sm:grid sm:grid-cols-3 sm:overflow-visible">
          <StatChip label="Total tareas" value={resumen?.total ?? "—"} color="ink" />
          <StatChip label="Obligatorias" value={resumen?.obligatorias ?? "—"} color="carne" />
          <StatChip label="Con fotos" value={resumen?.conFotos ?? "—"} color="fresco" />
        </div>

        {/* Buscador y Filtro Secundario */}
        <div
          className="p-3.5 rounded-xl border flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between shadow-xs bg-surface-raised"
          style={{ borderColor: TOKENS.line }}
        >
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted pointer-events-none">
              <IconoBuscar className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar tarea por título o descripción..."
              className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm rounded-lg border bg-surface-raised focus:outline-none focus:ring-2 focus:ring-[#1E2320]"
              style={{ borderColor: TOKENS.line }}
            />
            {busqueda && (
              <button
                type="button"
                onClick={() => setBusqueda("")}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-muted hover:text-foreground cursor-pointer"
              >
                <IconoCruz className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 p-1.5 rounded-xl border bg-surface-soft" style={{ borderColor: TOKENS.line }}>
            {(
              [
                { id: "todas", label: "Todas" },
                { id: "obligatorias", label: "Obligatorias" },
                { id: "con_fotos", label: "Con Fotos" },
              ] as const
            ).map((f) => {
              const activo = filtroTipo === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => { setFiltroTipo(f.id); lista.setPage(1); }}
                  aria-pressed={activo}
                  className={`min-w-0 flex-1 min-h-11 px-2 rounded-md text-xs sm:text-sm font-semibold transition-colors ${
                    activo
                      ? "bg-foreground text-background"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {lista.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">{lista.error}</p>}
        {lista.cargando ? (
          <p role="status" className="py-8 text-center text-sm text-muted">Cargando tareas…</p>
        ) : lista.items.length === 0 ? (
          <p className="rounded-lg border border-line bg-surface-raised p-6 text-sm text-muted">No hay tareas que coincidan con los filtros.</p>
        ) : (
          <>
            <ul aria-label="Catálogo de tareas" className="divide-y divide-line rounded-lg border border-line bg-surface-raised md:hidden">
              {lista.items.map((tarea) => (
                <li key={tarea.id} className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-muted">{tarea.categoria || "Góndola"}</p>
                      <h3 className="mt-1 text-sm font-semibold text-foreground">{tarea.nombre}</h3>
                    </div>
                    <button type="button" onClick={() => abrir(tarea)} aria-label={"Editar " + tarea.nombre} className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-line text-foreground hover:bg-surface-soft"><IconoEditar className="h-4 w-4" /></button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                    <StatusStamp tone={!tarea.activo ? "sub" : tarea.esObligatoria ? "carne" : "fresco"}>{!tarea.activo ? "Inactiva" : tarea.esObligatoria ? "Obligatoria" : "Activa"}</StatusStamp>
                    <span>{tarea.requiereFotos ? (tarea.fotosObligatorias ? "Fotos obligatorias" : "Fotos opcionales") : "Sin fotos"}</span>
                  </div>
                  <details className="mt-1 text-sm text-muted">
                    <summary className="flex min-h-11 cursor-pointer items-center rounded-md text-xs hover:text-foreground">Ver instrucciones y alcance</summary>
                    <p className="whitespace-pre-wrap">{tarea.descripcion || "Sin instrucciones adicionales."}</p>
                    <p className="mt-2">{tarea.todosLocales ? "Todos los locales" : (tarea.locales?.length ?? 0) + " locales seleccionados"}</p>
                    <p className="mt-1 text-xs">{tarea.fechaDesde.slice(0, 10)} · {tarea.fechaHasta?.slice(0, 10) ?? "Sin fecha de fin"}</p>
                  </details>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto rounded-lg border border-line bg-surface-raised md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line bg-surface-soft text-xs text-muted"><tr><th className="p-4">Tarea</th><th className="p-4">Estado</th><th className="p-4">Fotos</th><th className="p-4">Alcance</th><th className="p-4"><span className="sr-only">Acciones</span></th></tr></thead>
                <tbody className="divide-y divide-line">
                  {lista.items.map((tarea) => (
                    <tr key={tarea.id} className="hover:bg-surface-soft">
                      <td className="max-w-md p-4"><p className="text-xs text-muted">{tarea.categoria || "Góndola"}</p><p className="font-semibold text-foreground">{tarea.nombre}</p><p className="mt-1 line-clamp-2 text-sm text-muted">{tarea.descripcion}</p></td>
                      <td className="p-4"><StatusStamp tone={!tarea.activo ? "sub" : tarea.esObligatoria ? "carne" : "fresco"}>{!tarea.activo ? "Inactiva" : tarea.esObligatoria ? "Obligatoria" : "Activa"}</StatusStamp></td>
                      <td className="p-4 text-muted">{tarea.requiereFotos ? (tarea.fotosObligatorias ? "Antes y después · obligatorias" : "Antes y después · opcionales") : "Sin fotos"}</td>
                      <td className="p-4 text-muted">{tarea.todosLocales ? "Todos los locales" : (tarea.locales?.length ?? 0) + " locales"}</td>
                      <td className="p-4"><button type="button" onClick={() => abrir(tarea)} className="min-h-11 rounded-md border border-line px-3 text-foreground hover:bg-surface-soft">Editar</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        <Paginacion page={lista.page} limit={lista.limit} total={lista.datos?.total ?? 0} totalPages={lista.datos?.totalPages ?? 1} onPageChange={lista.setPage} onLimitChange={lista.setLimit} />

      </main>

      {/* Modal de Creación / Edición */}
      <Modal
        titulo={id ? `Editar Tarea · ${form?.nombre}` : "Crear Nueva Tarea"}
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
              if (
                await op.ejecutar(id ? "Actualizando tarea" : "Creando tarea", () =>
                  apiFetch(`/campo/tareas${id ? `/${id}` : ""}`, {
                    method: id ? "PUT" : "POST",
                    body: JSON.stringify(form),
                  }),
                )
              ) {
                setForm(null);
                lista.refrescar();
              }
            }}
            className="space-y-4 pt-2"
          >
            {op.error && (
              <div className="p-3 rounded-lg border text-xs font-medium text-red-700 bg-red-50 border-red-200">
                {op.error}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1">
                Nombre de la Tarea *
              </label>
              <input
                type="text"
                required
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Ej: Reposición de lácteos en góndola central, Limpieza de estantes..."
                className="w-full p-2.5 rounded-lg border bg-surface-raised text-sm font-sans focus:outline-none focus:ring-2 focus:ring-[#1E2320]"
                style={{ borderColor: TOKENS.line }}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1">
                  Categoría Operativa
                </label>
                {!categoriaPersonalizada ? (
                  <div className="flex gap-2">
                    <select
                      value={form.categoria}
                      onChange={(e) => {
                        if (e.target.value === "__OTRA__") {
                          setCategoriaPersonalizada(true);
                          setForm({ ...form, categoria: "" });
                        } else {
                          setForm({ ...form, categoria: e.target.value });
                        }
                      }}
                      className="w-full p-2.5 rounded-lg border bg-surface-raised text-sm font-sans focus:outline-none focus:ring-2 focus:ring-[#1E2320]"
                      style={{ borderColor: TOKENS.line }}
                    >
                      {CATEGORIAS_PRESET.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                      <option value="__OTRA__">+ Otra categoría personalizada</option>
                    </select>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      value={form.categoria}
                      onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                      placeholder="Ej: Auditoría, Degustación..."
                      className="w-full p-2.5 rounded-lg border bg-surface-raised text-sm font-sans"
                      style={{ borderColor: TOKENS.line }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setCategoriaPersonalizada(false);
                        setForm({ ...form, categoria: "Góndola" });
                      }}
                      className="px-2 text-xs text-muted hover:text-foreground"
                    >
                      Lista
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1">
                  Nivel de Obligatoriedad
                </label>
                <label className="flex items-center gap-2 p-2.5 rounded-lg border bg-surface-raised cursor-pointer" style={{ borderColor: TOKENS.line }}>
                  <input
                    type="checkbox"
                    checked={form.esObligatoria}
                    onChange={(e) => setForm({ ...form, esObligatoria: e.target.checked })}
                    className="w-4 h-4 rounded border-[#DAD5C9] text-[#8B2635] focus:ring-[#8B2635]"
                  />
                  <span className="text-xs font-bold text-foreground">
                    Marcar como Tarea Obligatoria
                  </span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1">
                Instrucciones / Procedimiento para el Impulsador
              </label>
              <textarea
                rows={2}
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                placeholder="Instrucciones claras sobre qué revisar, cómo acomodar los productos y criterios de aceptación..."
                className="w-full p-2.5 rounded-lg border bg-surface-raised text-sm"
                style={{ borderColor: TOKENS.line }}
              />
            </div>

            {/* Configuración Fotográfica */}
            <div className="p-3.5 rounded-xl border bg-[#ECE9E2]/50 space-y-2" style={{ borderColor: TOKENS.line }}>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.requiereFotos}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      requiereFotos: e.target.checked,
                      fotosObligatorias: e.target.checked ? form.fotosObligatorias : false,
                    })
                  }
                  className="w-4 h-4 rounded border-[#DAD5C9] text-foreground"
                />
                <span className="text-xs font-bold text-foreground inline-flex items-center gap-1.5">
                  <IconoCamara className="w-3.5 h-3.5" />
                  <span>Exigir Registro Fotográfico (Evidencia)</span>
                </span>
              </label>

              {form.requiereFotos && (
                <div className="pl-6 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.fotosObligatorias}
                      onChange={(e) => setForm({ ...form, fotosObligatorias: e.target.checked })}
                      className="w-4 h-4 rounded border-[#DAD5C9] text-[#8B2635]"
                    />
                    <span className="text-xs font-semibold text-[#8B2635]">
                      Fotos Obligatorias (No se puede marcar completada sin foto antes y después)
                    </span>
                  </label>
                </div>
              )}
            </div>

            {/* Alcance de Locales */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-muted">
                Alcance Geográfico
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, todosLocales: true, localIds: [] })}
                  className={`p-3 rounded-lg border text-left text-xs font-bold transition-all inline-flex items-center gap-1.5 ${
                    form.todosLocales
                      ? "bg-surface-raised border-[#1E2320] ring-1 ring-[#1E2320]"
                      : "bg-[#ECE9E2]/50 border-[#DAD5C9] text-muted"
                  }`}
                >
                  <IconoGlobo className="w-3.5 h-3.5" />
                  <span>Todos los Locales de la Empresa</span>
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, todosLocales: false })}
                  className={`p-3 rounded-lg border text-left text-xs font-bold transition-all inline-flex items-center gap-1.5 ${
                    !form.todosLocales
                      ? "bg-surface-raised border-[#1E2320] ring-1 ring-[#1E2320]"
                      : "bg-[#ECE9E2]/50 border-[#DAD5C9] text-muted"
                  }`}
                >
                  <IconoPin className="w-3.5 h-3.5" />
                  <span>Seleccionar Locales Específicos</span>
                </button>
              </div>

              {/* Selector de locales específicos si no es global */}
              {!form.todosLocales && (
                <div className="p-3 rounded-xl border bg-surface-raised space-y-2" style={{ borderColor: TOKENS.line }}>
                  <input
                    type="text"
                    value={busquedaLocal}
                    onChange={(e) => setBusquedaLocal(e.target.value)}
                    placeholder="Filtrar locales por nombre..."
                    className="w-full p-2 text-xs rounded border mb-2"
                    style={{ borderColor: TOKENS.line }}
                  />

                  <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                    {localesDisponibles
                      .filter((l) =>
                        !busquedaLocal.trim() ||
                        l.nombre.toLowerCase().includes(busquedaLocal.toLowerCase()),
                      )
                      .map((loc) => {
                        const seleccionado = form.localIds.includes(loc.id);
                        return (
                          <label
                            key={loc.id}
                            className={`flex items-center gap-2 p-2 rounded text-xs cursor-pointer ${
                              seleccionado ? "bg-[#EAF0F6] font-semibold" : "hover:bg-gray-50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={seleccionado}
                              onChange={(e) => {
                                setForm({
                                  ...form,
                                  localIds: e.target.checked
                                    ? [...form.localIds, loc.id]
                                    : form.localIds.filter((id) => id !== loc.id),
                                });
                              }}
                              className="w-3.5 h-3.5 rounded"
                            />
                            <span>{loc.nombre}</span>
                            <span className="text-muted font-mono text-[10px]">
                              ({loc.cliente.nombre})
                            </span>
                          </label>
                        );
                      })}
                  </div>

                  <p className="text-[11px] font-mono text-muted">
                    {form.localIds.length} locales seleccionados
                  </p>
                </div>
              )}
            </div>

            {/* Vigencia */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1">
                  Vigencia Desde *
                </label>
                <input
                  type="date"
                  required
                  value={form.fechaDesde}
                  onChange={(e) => setForm({ ...form, fechaDesde: e.target.value })}
                  className="w-full p-2.5 rounded-lg border bg-surface-raised text-sm font-mono"
                  style={{ borderColor: TOKENS.line }}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1">
                  Vigencia Hasta (Opcional)
                </label>
                <input
                  type="date"
                  value={form.fechaHasta}
                  onChange={(e) => setForm({ ...form, fechaHasta: e.target.value })}
                  className="w-full p-2.5 rounded-lg border bg-surface-raised text-sm font-mono"
                  style={{ borderColor: TOKENS.line }}
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-foreground">
                <input
                  type="checkbox"
                  checked={form.activo}
                  onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                  className="w-4 h-4 rounded border-[#DAD5C9] text-foreground"
                />
                <span>Tarea Activa en Plataforma</span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t" style={{ borderColor: TOKENS.line }}>
              <button
                type="button"
                onClick={() => setForm(null)}
                className="px-4 py-2 rounded-lg border text-xs font-bold uppercase tracking-wider bg-surface-raised hover:bg-gray-50"
                style={{ borderColor: TOKENS.line }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!!op.mensaje}
                className="px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider text-white shadow-sm transition-all hover:brightness-110 disabled:opacity-50"
                style={{ backgroundColor: TOKENS.ink }}
              >
                {op.mensaje ? "Guardando..." : id ? "Actualizar Tarea" : "Crear Tarea"}
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
