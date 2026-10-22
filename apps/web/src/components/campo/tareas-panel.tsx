"use client";

import React, { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { useListaCampo, useOperacionCampo } from "@/hooks/use-lista-campo";
import { fechaCalendario, fechaEnZonaIso } from "@/utils/fechas";
import { Modal } from "@/components/modal";
import { BotonEditar } from "@/components/boton-editar";
import { PantallaCarga } from "@/components/pantalla-carga";
import { Paginacion } from "@/components/paginacion";
import { IconoMas } from "@/components/icono-mas";
import { usePanel } from "@/components/panel/contexto";
import { destinatarioCampo } from "@/utils/equipo-campo";
import { SelectorLocalesTarea } from "./selector-locales-tarea";
import { HistorialTarea } from "./historial-tarea";
import {
  HojaInstruccionTarea,
  TarjetaTareaCatalogo,
} from "./tarjeta-tarea-catalogo";
import type { RespuestaPaginada } from "@/types/paginacion";
import { TOKENS } from "./tokens";
import { StatusStamp } from "./ui/status-stamp";
import {
  BuscadorCatalogo,
  ChipsFiltro,
  KpisFiltro,
} from "./ui/filtros-catalogo";
import { TopBar } from "./ui/top-bar";
import {
  IconoAlerta,
  IconoArchivo,
  IconoOjo,
  IconoCamara,
  IconoGlobo,
  IconoPin,
  IconoTareas,
} from "./ui/iconos-campo";
import type {
  FormTareaCampo,
  TareaCampo,
  RespuestaCatalogoTareasCampo,
} from "@/types/campo";
import { confirmar } from "@/components/confirmacion/confirmacion-controller";

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
  const { usuario } = usePanel();
  const destinatario = destinatarioCampo(usuario.rol?.equipoCampo);

  const [busqueda, setBusqueda] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>("Todas");
  const [filtroTipo, setFiltroTipo] = useState<
    "todas" | "obligatorias" | "con_fotos"
  >("todas");
  const [buscar, setBuscar] = useState("");
  const [archivo, setArchivo] = useState<"activas" | "archivadas" | "todas">(
    "activas",
  );
  const parametros = new URLSearchParams({ buscar });
  parametros.set("archivo", archivo);
  if (categoriaFiltro !== "Todas") parametros.set("categoria", categoriaFiltro);
  if (filtroTipo !== "todas") parametros.set("tipo", filtroTipo);
  const lista = useListaCampo<TareaCampo>(`/campo/tareas?${parametros}`, 0, 7);
  const datos = lista.datos as RespuestaCatalogoTareasCampo | null;
  const resumen = datos?.resumen;
  const puedeAdministrar = datos?.permisos?.puedeAdministrar === true;
  const puedeCrear = datos?.permisos?.crear === true;
  const puedeEditar = datos?.permisos?.editar === true;
  const puedeArchivar = datos?.permisos?.archivar === true;
  const { setPage } = lista;

  useEffect(() => {
    const timer = setTimeout(() => {
      setBuscar(busqueda.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [busqueda, setPage]);

  const [id, setId] = useState(0);
  const [versionEsperada, setVersionEsperada] = useState(1);
  const [historial, setHistorial] = useState<TareaCampo | null>(null);
  const [instruccion, setInstruccion] = useState<TareaCampo | null>(null);
  const [form, setForm] = useState<FormTareaCampo | null>(null);
  const [categoriaPersonalizada, setCategoriaPersonalizada] = useState(false);
  const formularioAbierto = !!form && (id ? puedeEditar : puedeCrear);

  const [nombresLocales, setNombresLocales] = useState<Record<string, string>>(
    {},
  );

  async function abrir(t?: TareaCampo) {
    if (!destinatario || (t ? !puedeEditar || t.archivadaEn : !puedeCrear))
      return;
    let localIds = t?.locales.map((x) => x.local.id) ?? [];
    const nombres: Record<string, string> = {};
    for (const local of t?.locales ?? [])
      nombres[local.local.id] = local.local.nombre;
    if (t && !t.todosLocales) {
      const seleccion: string[] = [];
      const ok = await op.ejecutar("Cargando clientes asignados", async () => {
        let page = 1,
          totalPages = 1;
        do {
          const r = await apiFetch<
            RespuestaPaginada<{ id: string; nombre: string }>
          >(`/campo/tareas/${t.id}/locales?page=${page}&limit=50`);
          for (const local of r.items) {
            seleccion.push(local.id);
            nombres[local.id] = local.nombre;
          }
          totalPages = r.totalPages;
          page += 1;
        } while (page <= totalPages);
      });
      if (!ok) return;
      localIds = seleccion;
    }
    setNombresLocales(nombres);
    setId(t?.id ?? 0);
    setVersionEsperada(t?.version ?? 1);
    op.limpiarError();

    const cat = t?.categoria || "Góndola";
    const esPreset = CATEGORIAS_PRESET.includes(cat);
    setCategoriaPersonalizada(!esPreset);

    setForm({
      nombre: t?.nombre ?? "",
      destinatario,
      descripcion: t?.descripcion ?? "",
      categoria: cat,
      esObligatoria: t?.esObligatoria ?? false,
      estado: t?.estado ?? "ABIERTA",
      todosLocales: t?.todosLocales ?? true,
      activo: t?.activo ?? true,
      fechaDesde: fechaCalendario(t?.fechaDesde) ?? fechaEnZonaIso(new Date()),
      fechaHasta: fechaCalendario(t?.fechaHasta) ?? "",
      localIds,
      requiereFotos: t?.requiereFotos ?? false,
      fotosObligatorias: t?.fotosObligatorias ?? false,
    });
  }

  async function eliminar(tarea: TareaCampo) {
    if (!puedeArchivar || tarea.archivadaEn) return;
    if (
      !(await confirmar({
        titulo: "Archivar tarea",
        mensaje: `¿Archivar la tarea «${tarea.nombre}»? Se conservarán sus cumplimientos, versiones y evidencias.`,
        textoConfirmar: "Archivar",
      }))
    )
      return;
    await op.ejecutar("Archivando tarea", async () => {
      await apiFetch(`/campo/tareas/${tarea.id}`, { method: "DELETE" });
      lista.refrescar();
    });
  }

  return (
    <div
      className="campo-screen min-w-0 w-full min-h-screen text-[13px] font-sans pb-16"
      style={{ backgroundColor: TOKENS.bone, color: TOKENS.ink }}
    >
      <TopBar
        title="Catálogo de Tareas"
        subtitle={
          puedeAdministrar
            ? "Repositorio de tareas operativas y protocolos para el equipo en calle"
            : "Consultá las instrucciones y el alcance de las tareas · Solo lectura"
        }
        right={
          puedeCrear ? (
            <button
              type="button"
              onClick={() => abrir()}
              disabled={!destinatario}
              aria-label="Crear tarea"
              title="Crear tarea"
              className="grid h-11 w-11 place-items-center rounded-lg text-white transition-colors hover:brightness-110"
              style={{ backgroundColor: TOKENS.carne }}
            >
              <IconoMas className="w-4 h-4" />
            </button>
          ) : null
        }
      />

      <main
        data-inicio-listado
        className="max-w-7xl min-w-0 mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-3 sm:space-y-5 scroll-mt-20"
      >
        {/* Indicadores que filtran por tipo (reemplazan Todas / Obligatorias / Con fotos) */}
        <KpisFiltro
          etiqueta="Filtrar tareas por tipo"
          seleccionado={filtroTipo}
          onSeleccionar={(clave) => {
            setFiltroTipo(clave);
            lista.setPage(1);
          }}
          items={[
            {
              clave: "todas",
              etiqueta: "Tareas",
              valor: resumen?.total ?? "—",
              detalle: "En el catálogo",
              icono: <IconoTareas />,
              tono: "marca",
            },
            {
              clave: "obligatorias",
              etiqueta: "Obligatorias",
              valor: resumen?.obligatorias ?? "—",
              detalle: "De cumplimiento obligatorio",
              icono: <IconoAlerta />,
              tono: "rojo",
            },
            {
              clave: "con_fotos",
              etiqueta: "Con fotos",
              valor: resumen?.conFotos ?? "—",
              detalle: "Requieren evidencia",
              icono: <IconoCamara />,
              tono: "celeste",
            },
          ]}
        />

        <div className="flex min-w-0 gap-2">
          <BuscadorCatalogo
            valor={busqueda}
            onCambio={setBusqueda}
            placeholder="Buscar por título o descripción"
            etiqueta="Buscar tarea"
          />
          <button
            type="button"
            aria-pressed={archivo === "archivadas"}
            onClick={() => {
              setArchivo((actual) =>
                actual === "archivadas" ? "activas" : "archivadas",
              );
              lista.setPage(1);
            }}
            title="Ver las tareas archivadas"
            className={`inline-flex h-11 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
              archivo === "archivadas"
                ? "border-foreground bg-foreground text-background"
                : "border-line bg-surface-raised text-muted hover:border-brand-500 hover:text-foreground"
            }`}
          >
            <IconoArchivo className="h-4 w-4" />
            Archivadas
          </button>
        </div>

        {archivo === "archivadas" ? (
          <p
            role="status"
            className="flex items-start gap-2 rounded-xl border border-stone-200 bg-stone-50 p-3 text-xs text-stone-700 dark:border-stone-700 dark:bg-stone-900/50 dark:text-stone-200"
          >
            <IconoArchivo className="mt-px h-4 w-4 shrink-0" />
            <span>
              Estás viendo las tareas <b>archivadas</b>: ya no se asignan en las
              visitas, pero conservan su historial y sus evidencias. Tocá
              «Archivadas» otra vez para volver a las vigentes.
            </span>
          </p>
        ) : null}

        <ChipsFiltro
          etiqueta="Filtrar por categoría"
          opciones={["Todas", ...CATEGORIAS_PRESET].map((cat) => ({
            clave: cat,
            etiqueta: cat,
          }))}
          seleccionado={categoriaFiltro}
          onSeleccionar={(cat) => {
            setCategoriaFiltro(cat);
            lista.setPage(1);
          }}
        />

        {lista.error && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200"
          >
            {lista.error}
          </p>
        )}
        {op.error && !form && (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
          >
            {op.error}
          </p>
        )}
        {lista.cargando ? (
          <p role="status" className="py-8 text-center text-sm text-muted">
            Cargando tareas…
          </p>
        ) : lista.items.length === 0 ? (
          <p className="rounded-lg border border-line bg-surface-raised p-6 text-sm text-muted">
            No hay tareas que coincidan con los filtros.
          </p>
        ) : (
          <>
            <ul
              aria-label="Catálogo de tareas"
              className="grid gap-2.5 md:hidden"
            >
              {lista.items.map((tarea) => (
                <li key={tarea.id} className="min-w-0">
                  <TarjetaTareaCatalogo
                    tarea={tarea}
                    puedeEditar={puedeAdministrar && puedeEditar}
                    puedeArchivar={puedeAdministrar && puedeArchivar}
                    ocupado={!!op.mensaje}
                    onVerInstruccion={() => setInstruccion(tarea)}
                    onEditar={() => abrir(tarea)}
                    onArchivar={() => void eliminar(tarea)}
                    onHistorial={() => setHistorial(tarea)}
                  />
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto rounded-lg border border-line bg-surface-raised md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line bg-surface-soft text-xs text-muted">
                  <tr>
                    <th className="p-4">Tarea</th>
                    <th className="p-4">Estado</th>
                    <th className="p-4">Fotos</th>
                    <th className="p-4">Alcance</th>
                    {puedeAdministrar ? (
                      <th className="p-4">
                        <span className="sr-only">Acciones</span>
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {lista.items.map((tarea) => (
                    <tr key={tarea.id} className="hover:bg-surface-soft">
                      <td className="max-w-md p-4">
                        <p className="text-xs text-muted">
                          {tarea.categoria || "Góndola"} ·{" "}
                          {tarea.destinatario === "AMBOS"
                            ? "Ambos"
                            : tarea.destinatario === "REPOSITOR"
                              ? "Repositor"
                              : "Impulsador"}
                        </p>
                        <p className="font-semibold text-foreground">
                          {tarea.nombre}
                        </p>
                        <button
                          type="button"
                          onClick={() => setInstruccion(tarea)}
                          aria-label={`Ver instrucción de ${tarea.nombre}`}
                          className="mt-1.5 mr-2 inline-flex min-h-11 cursor-pointer items-center gap-1 whitespace-nowrap rounded-lg bg-emerald-600 px-2.5 text-xs font-bold text-white transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus dark:bg-emerald-500 dark:text-emerald-950 dark:hover:bg-emerald-400"
                        >
                          <IconoOjo className="h-3.5 w-3.5" />
                          Instrucción
                        </button>
                        <button
                          type="button"
                          className="min-h-11 rounded-lg px-2 text-xs text-foreground hover:bg-surface-soft"
                          onClick={() => setHistorial(tarea)}
                        >
                          Historial · versión {tarea.version}
                        </button>
                      </td>
                      <td className="p-4">
                        <StatusStamp
                          tone={
                            !tarea.activo
                              ? "sub"
                              : tarea.esObligatoria
                                ? "carne"
                                : "fresco"
                          }
                        >
                          {tarea.archivadaEn
                            ? "Archivada"
                            : !tarea.activo
                              ? "Inactiva"
                              : tarea.esObligatoria
                                ? "Obligatoria"
                                : "Activa"}
                        </StatusStamp>
                      </td>
                      <td className="p-4 text-muted">
                        {tarea.requiereFotos
                          ? tarea.fotosObligatorias
                            ? "Antes y después · obligatorias"
                            : "Antes y después · opcionales"
                          : "Sin fotos"}
                      </td>
                      <td className="p-4 text-muted">
                        {tarea.todosLocales
                          ? "Todos los clientes"
                          : (tarea.locales?.length ?? 0) + " clientes"}
                      </td>
                      {puedeAdministrar ? (
                        <td className="p-4">
                          <div className="flex flex-wrap gap-2">
                            {puedeEditar && !tarea.archivadaEn ? (
                              <BotonEditar
                                onClick={() => abrir(tarea)}
                                etiqueta={`Editar tarea ${tarea.nombre}`}
                              />
                            ) : null}
                            {puedeArchivar && !tarea.archivadaEn ? (
                              <button
                                type="button"
                                onClick={() => void eliminar(tarea)}
                                disabled={!!op.mensaje}
                                title="Archivar: deja de asignarse, conserva su historial"
                                className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-md border border-line px-3 text-muted hover:border-red-400 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:text-red-300"
                              >
                                <IconoArchivo className="h-4 w-4" />
                                Archivar
                              </button>
                            ) : null}
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        <Paginacion
          page={lista.page}
          limit={lista.limit}
          total={lista.datos?.total ?? 0}
          totalPages={lista.datos?.totalPages ?? 1}
          onPageChange={lista.setPage}
          onLimitChange={lista.setLimit}
        />
      </main>

      {instruccion ? (
        <HojaInstruccionTarea
          tarea={instruccion}
          cerrar={() => setInstruccion(null)}
        />
      ) : null}

      {/* Modal de Creación / Edición */}
      {historial ? (
        <HistorialTarea
          tareaId={historial.id}
          nombre={historial.nombre}
          cerrar={() => setHistorial(null)}
        />
      ) : null}
      <Modal
        titulo={id ? `Editar Tarea · ${form?.nombre}` : "Crear Nueva Tarea"}
        abierto={formularioAbierto}
        onCerrar={() => {
          if (!op.mensaje) setForm(null);
        }}
        ancho="lg"
      >
        {form && formularioAbierto && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!formularioAbierto) return;
              if (
                await op.ejecutar(
                  id ? "Actualizando tarea" : "Creando tarea",
                  () =>
                    apiFetch(`/campo/tareas${id ? `/${id}` : ""}`, {
                      method: id ? "PUT" : "POST",
                      body: JSON.stringify({
                        ...form,
                        ...(id ? { versionEsperada } : {}),
                        fechaDesde:
                          fechaCalendario(form.fechaDesde) ?? form.fechaDesde,
                        fechaHasta: fechaCalendario(form.fechaHasta),
                      }),
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
                <label
                  htmlFor="destinatario-tarea"
                  className="block text-xs font-bold uppercase tracking-wider text-muted mb-1"
                >
                  Destinatario
                </label>
                <select
                  id="destinatario-tarea"
                  value={form.destinatario}
                  disabled
                  className="min-h-11 w-full rounded-lg border border-line bg-surface-raised p-2.5 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-focus"
                >
                  <option value={form.destinatario}>
                    {usuario.rol?.equipoCampo?.nombre ?? "Sin equipo"}
                  </option>
                </select>
                <p className="mt-1 text-xs text-muted">
                  Se asigna automáticamente según tu equipo.
                </p>
              </div>
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
                      <option value="__OTRA__">
                        + Otra categoría personalizada
                      </option>
                    </select>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      value={form.categoria}
                      onChange={(e) =>
                        setForm({ ...form, categoria: e.target.value })
                      }
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
                <label
                  className="flex items-center gap-2 p-2.5 rounded-lg border bg-surface-raised cursor-pointer"
                  style={{ borderColor: TOKENS.line }}
                >
                  <input
                    type="checkbox"
                    checked={form.esObligatoria}
                    onChange={(e) =>
                      setForm({ ...form, esObligatoria: e.target.checked })
                    }
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
                Instrucciones / Procedimiento para el destinatario
              </label>
              <textarea
                rows={2}
                value={form.descripcion}
                onChange={(e) =>
                  setForm({ ...form, descripcion: e.target.value })
                }
                placeholder="Instrucciones claras sobre qué revisar, cómo acomodar los productos y criterios de aceptación..."
                className="w-full p-2.5 rounded-lg border bg-surface-raised text-sm"
                style={{ borderColor: TOKENS.line }}
              />
            </div>

            {/* Configuración Fotográfica */}
            <div
              className="p-3.5 rounded-xl border bg-[#ECE9E2]/50 space-y-2"
              style={{ borderColor: TOKENS.line }}
            >
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.requiereFotos}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      requiereFotos: e.target.checked,
                      fotosObligatorias: e.target.checked
                        ? form.fotosObligatorias
                        : false,
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
                      onChange={(e) =>
                        setForm({
                          ...form,
                          fotosObligatorias: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded border-[#DAD5C9] text-[#8B2635]"
                    />
                    <span className="text-xs font-semibold text-[#8B2635]">
                      Fotos Obligatorias (No se puede marcar completada sin foto
                      antes y después)
                    </span>
                  </label>
                </div>
              )}
            </div>

            {/* Alcance: todos los clientes o una selección */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-muted">
                Alcance Geográfico
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setForm({ ...form, todosLocales: true, localIds: [] })
                  }
                  className={`p-3 rounded-lg border text-left text-xs font-bold transition-all inline-flex items-center gap-1.5 ${
                    form.todosLocales
                      ? "bg-surface-raised border-[#1E2320] ring-1 ring-[#1E2320]"
                      : "bg-[#ECE9E2]/50 border-[#DAD5C9] text-muted"
                  }`}
                >
                  <IconoGlobo className="w-3.5 h-3.5" />
                  <span>Todos los clientes de la empresa</span>
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
                  <span>Seleccionar clientes específicos</span>
                </button>
              </div>

              {!form.todosLocales ? (
                <SelectorLocalesTarea
                  ids={form.localIds}
                  nombres={nombresLocales}
                  onChange={(ids, nombres) => {
                    setForm({ ...form, localIds: ids });
                    setNombresLocales(nombres);
                  }}
                />
              ) : null}
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
                  onChange={(e) =>
                    setForm({ ...form, fechaDesde: e.target.value })
                  }
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
                  min={form.fechaDesde}
                  value={form.fechaHasta}
                  onChange={(e) =>
                    setForm({ ...form, fechaHasta: e.target.value })
                  }
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
                  onChange={(e) =>
                    setForm({ ...form, activo: e.target.checked })
                  }
                  className="w-4 h-4 rounded border-[#DAD5C9] text-foreground"
                />
                <span>Tarea Activa en Plataforma</span>
              </label>
            </div>

            <div
              className="flex flex-col-reverse gap-3 pt-4 border-t sm:flex-row sm:items-center sm:justify-end"
              style={{ borderColor: TOKENS.line }}
            >
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
                {op.mensaje
                  ? "Guardando..."
                  : id
                    ? "Actualizar Tarea"
                    : "Crear Tarea"}
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
