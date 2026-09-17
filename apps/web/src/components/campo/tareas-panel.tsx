"use client";

import React, { useMemo, useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { useListaCampo, useOperacionCampo } from "@/hooks/use-lista-campo";
import { fechaEnZonaIso } from "@/utils/fechas";
import { Modal } from "@/components/modal";
import { PantallaCarga } from "@/components/pantalla-carga";
import { TOKENS } from "./tokens";
import { StatusStamp } from "./ui/status-stamp";
import { StatChip } from "./ui/stat-chip";
import { TopBar } from "./ui/top-bar";
import {
  IconoBuscar,
  IconoCruz,
  IconoMas,
  IconoEditar,
  IconoGlobo,
  IconoPin,
  IconoCamara,
  IconoTareas,
} from "./ui/iconos-campo";
import type { FormTareaCampo, TareaCampo, LocalCampo } from "@/types/campo";

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
  const lista = useListaCampo<TareaCampo>("/campo/tareas");
  const op = useOperacionCampo();

  const [busqueda, setBusqueda] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>("Todas");
  const [filtroTipo, setFiltroTipo] = useState<"todas" | "obligatorias" | "con_fotos">("todas");

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

  // Filtrado de tareas
  const tareasFiltradas = useMemo(() => {
    return lista.items.filter((t) => {
      const matchBusqueda =
        !busqueda.trim() ||
        t.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        t.descripcion.toLowerCase().includes(busqueda.toLowerCase());

      const matchCategoria =
        categoriaFiltro === "Todas" || (t.categoria || "Góndola") === categoriaFiltro;

      const matchTipo =
        filtroTipo === "todas" ||
        (filtroTipo === "obligatorias" && t.esObligatoria) ||
        (filtroTipo === "con_fotos" && t.requiereFotos);

      return matchBusqueda && matchCategoria && matchTipo;
    });
  }, [lista.items, busqueda, categoriaFiltro, filtroTipo]);

  const totalObligatorias = useMemo(
    () => lista.items.filter((t) => t.esObligatoria).length,
    [lista.items],
  );
  const totalConFotos = useMemo(
    () => lista.items.filter((t) => t.requiereFotos).length,
    [lista.items],
  );

  return (
    <div
      className="min-h-screen text-[13px] font-sans pb-16"
      style={{ backgroundColor: TOKENS.bone, color: TOKENS.ink }}
    >
      <TopBar
        title="Catálogo de Tareas"
        subtitle="Repositorio de tareas operativas y protocolos para el equipo en calle"
        right={
          <button
            type="button"
            onClick={() => abrir()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold uppercase tracking-wider text-white shadow-sm transition-all hover:brightness-110 active:scale-95 cursor-pointer shrink-0"
            style={{ backgroundColor: TOKENS.carne }}
          >
            <IconoMas className="w-4 h-4" />
            <span>Nueva Tarea</span>
          </button>
        }
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        {/* KPI Chips */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <StatChip
            label="Total Tareas"
            value={lista.items.length}
            sub="En el catálogo de la empresa"
            color="ink"
          />
          <StatChip
            label="Tareas Obligatorias"
            value={totalObligatorias}
            sub="Control crítico de góndola"
            color="carne"
          />
          <StatChip
            label="Validación con Fotos"
            value={totalConFotos}
            sub="Evidencia antes y después"
            color="fresco"
          />
        </div>

        {/* Filtros por Categoría */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {["Todas", ...CATEGORIAS_PRESET].map((cat) => {
            const activo = categoriaFiltro === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoriaFiltro(cat)}
                className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
                  activo
                    ? "bg-[#1E2320] text-white shadow-sm"
                    : "bg-white text-[#726C60] hover:text-[#1E2320] border"
                }`}
                style={{ borderColor: activo ? "transparent" : TOKENS.line }}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Buscador y Filtro Secundario */}
        <div
          className="p-3.5 rounded-xl border flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between shadow-xs bg-white"
          style={{ borderColor: TOKENS.line }}
        >
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-400 pointer-events-none">
              <IconoBuscar className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar tarea por título o descripción..."
              className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm rounded-lg border bg-white focus:outline-none focus:ring-2 focus:ring-[#1E2320]"
              style={{ borderColor: TOKENS.line }}
            />
            {busqueda && (
              <button
                type="button"
                onClick={() => setBusqueda("")}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-zinc-400 hover:text-zinc-800 cursor-pointer"
              >
                <IconoCruz className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 p-1.5 rounded-xl border bg-[#ECE9E2]/60" style={{ borderColor: TOKENS.line }}>
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
                  onClick={() => setFiltroTipo(f.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    activo
                      ? "bg-[#1E2320] text-white shadow-sm"
                      : "text-[#726C60] hover:text-[#1E2320]"
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Grilla de Tareas */}
        {lista.cargando && !lista.items.length ? (
          <div className="py-16 text-center text-[#726C60]">
            <div className="w-8 h-8 mx-auto border-2 border-[#1E2320] border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-xs font-mono">Cargando tareas del equipo...</p>
          </div>
        ) : tareasFiltradas.length === 0 ? (
          <div
            className="p-12 text-center rounded-xl border"
            style={{ backgroundColor: TOKENS.canvas, borderColor: TOKENS.line }}
          >
            <p className="text-base font-bold text-[#1E2320] mb-1">
              No hay tareas que coincidan
            </p>
            <p className="text-xs text-[#726C60] mb-4">
              {busqueda || categoriaFiltro !== "Todas" || filtroTipo !== "todas"
                ? "Prueba cambiando los filtros seleccionados"
                : "Crea tu primera tarea para que los impulsadores la realicen en sus visitas."}
            </p>
            <button
              type="button"
              onClick={() => abrir()}
              className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider text-white"
              style={{ backgroundColor: TOKENS.ink }}
            >
              + Crear Tarea
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {tareasFiltradas.map((tarea) => {
              const cat = tarea.categoria || "Góndola";
              return (
                <div
                  key={tarea.id}
                  className="p-6 sm:p-7 rounded-2xl border transition-all hover:shadow-xl flex flex-col justify-between bg-white shadow-xs"
                  style={{ borderColor: TOKENS.line }}
                >
                  <div>
                    {/* Encabezado */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <span
                        className="text-xs sm:text-sm font-mono uppercase px-3 py-1 rounded-lg font-extrabold"
                        style={{
                          backgroundColor:
                            cat === "Precios"
                              ? "#EAF0F6"
                              : cat === "Limpieza"
                              ? "#F0FDF4"
                              : "#F6ECEC",
                          color:
                            cat === "Precios"
                              ? TOKENS.frio
                              : cat === "Limpieza"
                              ? TOKENS.fresco
                              : TOKENS.carne,
                        }}
                      >
                        {cat}
                      </span>

                      <StatusStamp
                        tone={
                          !tarea.activo
                            ? "sub"
                            : tarea.esObligatoria
                            ? "carne"
                            : "fresco"
                        }
                        size="sm"
                      >
                        {!tarea.activo
                          ? "INACTIVA"
                          : tarea.esObligatoria
                          ? "OBLIGATORIA"
                          : "ACTIVA"}
                      </StatusStamp>
                    </div>

                    <h3 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-[#1E2320] ft-display leading-tight mb-2">
                      {tarea.nombre}
                    </h3>

                    <p className="text-sm sm:text-base text-[#726C60] line-clamp-2 mb-4 leading-relaxed font-medium">
                      {tarea.descripcion || "Sin instrucciones adicionales."}
                    </p>

                    {/* Metadata chips */}
                    <div
                      className="space-y-2 py-3 border-y my-2.5 text-xs text-zinc-800"
                      style={{ borderColor: TOKENS.line }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[#1E2320] font-bold">Alcance:</span>
                        <span className="truncate font-medium inline-flex items-center gap-1">
                          {tarea.todosLocales ? (
                            <>
                              <IconoGlobo className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                              <span>Todos los locales de la empresa</span>
                            </>
                          ) : (
                            <>
                              <IconoPin className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                              <span>{tarea.locales?.length ?? 0} locales seleccionados</span>
                            </>
                          )}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[#1E2320] font-bold">Validación:</span>
                        <span className="font-medium inline-flex items-center gap-1">
                          {tarea.requiereFotos ? (
                            <span className="font-semibold text-[#8B2635] inline-flex items-center gap-1">
                              <IconoCamara className="w-3.5 h-3.5 shrink-0" />
                              <span>Fotos {tarea.fotosObligatorias ? "Obligatorias" : "Opcionales"}</span>
                            </span>
                          ) : (
                            "Sin fotos requeridas"
                          )}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs font-mono text-zinc-600">
                        <span className="text-[#1E2320] font-bold">Vigencia:</span>
                        <span>
                          {tarea.fechaDesde.slice(0, 10)} {tarea.fechaHasta ? `al ${tarea.fechaHasta.slice(0, 10)}` : "· Permanente"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="pt-2.5 flex items-center justify-end border-t border-[#DAD5C9]/60 mt-1">
                    <button
                      type="button"
                      onClick={() => abrir(tarea)}
                      className="px-3 py-1.5 rounded-lg border text-xs font-bold uppercase tracking-wider text-[#1E2320] bg-zinc-50 hover:bg-zinc-100 flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                      style={{ borderColor: TOKENS.line }}
                    >
                      <IconoEditar className="w-3.5 h-3.5" />
                      <span>Editar Tarea</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
              <label className="block text-xs font-bold uppercase tracking-wider text-[#726C60] mb-1">
                Nombre de la Tarea *
              </label>
              <input
                type="text"
                required
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Ej: Reposición de lácteos en góndola central, Limpieza de estantes..."
                className="w-full p-2.5 rounded-lg border bg-white text-sm font-sans focus:outline-none focus:ring-2 focus:ring-[#1E2320]"
                style={{ borderColor: TOKENS.line }}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#726C60] mb-1">
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
                      className="w-full p-2.5 rounded-lg border bg-white text-sm font-sans focus:outline-none focus:ring-2 focus:ring-[#1E2320]"
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
                      className="w-full p-2.5 rounded-lg border bg-white text-sm font-sans"
                      style={{ borderColor: TOKENS.line }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setCategoriaPersonalizada(false);
                        setForm({ ...form, categoria: "Góndola" });
                      }}
                      className="px-2 text-xs text-[#726C60] hover:text-[#1E2320]"
                    >
                      Lista
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#726C60] mb-1">
                  Nivel de Obligatoriedad
                </label>
                <label className="flex items-center gap-2 p-2.5 rounded-lg border bg-white cursor-pointer" style={{ borderColor: TOKENS.line }}>
                  <input
                    type="checkbox"
                    checked={form.esObligatoria}
                    onChange={(e) => setForm({ ...form, esObligatoria: e.target.checked })}
                    className="w-4 h-4 rounded border-[#DAD5C9] text-[#8B2635] focus:ring-[#8B2635]"
                  />
                  <span className="text-xs font-bold text-[#1E2320]">
                    Marcar como Tarea Obligatoria
                  </span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#726C60] mb-1">
                Instrucciones / Procedimiento para el Impulsador
              </label>
              <textarea
                rows={2}
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                placeholder="Instrucciones claras sobre qué revisar, cómo acomodar los productos y criterios de aceptación..."
                className="w-full p-2.5 rounded-lg border bg-white text-sm"
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
                  className="w-4 h-4 rounded border-[#DAD5C9] text-[#1E2320]"
                />
                <span className="text-xs font-bold text-[#1E2320] inline-flex items-center gap-1.5">
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
              <label className="block text-xs font-bold uppercase tracking-wider text-[#726C60]">
                Alcance Geográfico
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, todosLocales: true, localIds: [] })}
                  className={`p-3 rounded-lg border text-left text-xs font-bold transition-all inline-flex items-center gap-1.5 ${
                    form.todosLocales
                      ? "bg-white border-[#1E2320] ring-1 ring-[#1E2320]"
                      : "bg-[#ECE9E2]/50 border-[#DAD5C9] text-[#726C60]"
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
                      ? "bg-white border-[#1E2320] ring-1 ring-[#1E2320]"
                      : "bg-[#ECE9E2]/50 border-[#DAD5C9] text-[#726C60]"
                  }`}
                >
                  <IconoPin className="w-3.5 h-3.5" />
                  <span>Seleccionar Locales Específicos</span>
                </button>
              </div>

              {/* Selector de locales específicos si no es global */}
              {!form.todosLocales && (
                <div className="p-3 rounded-xl border bg-white space-y-2" style={{ borderColor: TOKENS.line }}>
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
                            <span className="text-[#726C60] font-mono text-[10px]">
                              ({loc.cliente.nombre})
                            </span>
                          </label>
                        );
                      })}
                  </div>

                  <p className="text-[11px] font-mono text-[#726C60]">
                    {form.localIds.length} locales seleccionados
                  </p>
                </div>
              )}
            </div>

            {/* Vigencia */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#726C60] mb-1">
                  Vigencia Desde *
                </label>
                <input
                  type="date"
                  required
                  value={form.fechaDesde}
                  onChange={(e) => setForm({ ...form, fechaDesde: e.target.value })}
                  className="w-full p-2.5 rounded-lg border bg-white text-sm font-mono"
                  style={{ borderColor: TOKENS.line }}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#726C60] mb-1">
                  Vigencia Hasta (Opcional)
                </label>
                <input
                  type="date"
                  value={form.fechaHasta}
                  onChange={(e) => setForm({ ...form, fechaHasta: e.target.value })}
                  className="w-full p-2.5 rounded-lg border bg-white text-sm font-mono"
                  style={{ borderColor: TOKENS.line }}
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-[#1E2320]">
                <input
                  type="checkbox"
                  checked={form.activo}
                  onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                  className="w-4 h-4 rounded border-[#DAD5C9] text-[#1E2320]"
                />
                <span>Tarea Activa en Plataforma</span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t" style={{ borderColor: TOKENS.line }}>
              <button
                type="button"
                onClick={() => setForm(null)}
                className="px-4 py-2 rounded-lg border text-xs font-bold uppercase tracking-wider bg-white hover:bg-gray-50"
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
