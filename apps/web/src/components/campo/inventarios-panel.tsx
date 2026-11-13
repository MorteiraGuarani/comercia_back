"use client";

import { Fragment, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { apiFetch, descargarArchivo } from "@/lib/api";
import { BotonEliminarCampo } from "@/components/campo/boton-eliminar-campo";
import { confirmar } from "@/components/confirmacion/confirmacion-controller";
import { PantallaCarga } from "@/components/pantalla-carga";
import { Paginacion } from "@/components/paginacion";
import { SkeletonFilas } from "@/components/skeleton";
import { mostrarToast } from "@/components/toast/toast-controller";
import { SelectorPaginado } from "@/components/selector-paginado";
import { ConfigVencimientosModal } from "@/components/campo/config-vencimientos-modal";
import { IconoCalendario, IconoChevronAbajo } from "@/components/campo/ui/iconos-campo";
import { SelectorFechaFiltro } from "@/components/campo/ui/selector-fecha-filtro";
import { btnGhost, btnPrimary, errorBox } from "@/components/ui";
import { useHojaDeslizable } from "@/hooks/use-hoja-deslizable";
import { useListaCampo } from "@/hooks/use-lista-campo";
import type {
  CargaInventarioFila,
  EstadoCargaInventario,
  FiltrosCargaInventario,
} from "@/types/inventario-cargas";
import type { PeriodoFiltro } from "@/types/periodo-filtro";
import { fechaEnZonaIso, formatoFechaCalendario, formatoFechaHora } from "@/utils/fechas";
import {
  periodosDesdeHoy,
  periodosInventario,
  rangoPeriodoInicio,
} from "@/utils/periodo-inicio";

const BASE = "/campo/inventario/cargas";
const SIN_PERIODO: PeriodoFiltro = { clave: "", etiqueta: "" };
const SIN_FILTROS: FiltrosCargaInventario = {
  periodo: null,
  estado: "",
  empresaId: "",
  equipoId: "",
  responsableId: "",
};

const ESTILO_ESTADO: Record<EstadoCargaInventario, string> = {
  VIGENTE:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200/80",
  POR_VENCER:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200/80",
  VENCIDO:
    "border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200/80",
};

// Lo más urgente arriba.
const SECCIONES: { estado: EstadoCargaInventario; titulo: string; punto: string }[] = [
  { estado: "VENCIDO", titulo: "Vencidos", punto: "bg-red-600 dark:bg-red-400" },
  { estado: "POR_VENCER", titulo: "Por vencer", punto: "bg-amber-500 dark:bg-amber-400" },
  { estado: "VIGENTE", titulo: "Vigentes", punto: "bg-emerald-600 dark:bg-emerald-400" },
];

const FOCO =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus";
const BOTON_CABECERA = `inline-flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-full border border-line bg-surface-raised px-3 text-sm font-semibold text-foreground transition-colors hover:bg-surface-soft disabled:cursor-not-allowed disabled:opacity-50 ${FOCO}`;

type ListaCargas = ReturnType<typeof useListaCampo<CargaInventarioFila>>;

// El rol y el equipo a veces se llaman igual: no repetir.
const puestoDe = (c: CargaInventarioFila) =>
  [...new Set([c.usuario.rol, c.usuario.equipo].filter(Boolean))].join(" · ");

const fechaCorta = (iso: string) => formatoFechaCalendario(iso) ?? iso;

function textoVence(dias: number) {
  if (dias < 0) return dias === -1 ? "Venció ayer" : `Venció hace ${-dias} días`;
  if (dias === 0) return "Vence hoy";
  return dias === 1 ? "Vence mañana" : `Vence en ${dias} días`;
}

function Persona({ c, conEmpresa }: { c: CargaInventarioFila; conEmpresa: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-sm font-bold text-foreground">{c.usuario.nombre}</p>
      <p className="truncate text-[11px] text-muted">
        {[conEmpresa ? c.usuario.empresa : null, puestoDe(c)]
          .filter(Boolean)
          .join(" · ")}
      </p>
    </div>
  );
}

function Producto({ c }: { c: CargaInventarioFila }) {
  return (
    <div className="min-w-0">
      <p className="break-words text-sm font-semibold text-foreground">{c.producto}</p>
      <p className="font-mono text-[11px] text-muted">{c.itemcode}</p>
    </div>
  );
}

/** Días que faltan (o que pasaron, en negativo) para el vencimiento. */
function Dias({ c }: { c: CargaInventarioFila }) {
  return (
    <span
      title={textoVence(c.diasParaVencer)}
      className={`inline-flex min-w-14 shrink-0 items-center justify-center whitespace-nowrap rounded-lg border px-2 py-1 text-xs font-bold ${ESTILO_ESTADO[c.estado]}`}
    >
      {c.diasParaVencer < 0 ? "−" : ""}
      {Math.abs(c.diasParaVencer)} d
    </span>
  );
}

function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted">{etiqueta}</dt>
      <dd className="min-w-0 break-words text-foreground">{children}</dd>
    </>
  );
}

/** Lo que se despliega debajo de la fila, igual en celular y en escritorio. */
function Detalle({
  c,
  conEmpresa,
  onEliminar,
}: {
  c: CargaInventarioFila;
  conEmpresa: boolean;
  onEliminar: () => void;
}) {
  return (
    <div className="space-y-3 border-t border-line bg-surface px-4 py-3">
      <span
        className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold ${ESTILO_ESTADO[c.estado]}`}
      >
        {textoVence(c.diasParaVencer)}
      </span>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-xs lg:grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)]">
        <Dato etiqueta="Local">{c.local.nombre}</Dato>
        <Dato etiqueta="Cantidad">
          <span className="font-mono">{c.cantidad}</span>
        </Dato>
        <Dato etiqueta="Vence">{fechaCorta(c.vencimiento)}</Dato>
        <Dato etiqueta="Fecha">{fechaCorta(c.fecha)}</Dato>
        <Dato etiqueta="Cargado por">{c.usuario.nombre}</Dato>
        <Dato etiqueta="Puesto">{puestoDe(c)}</Dato>
        {conEmpresa ? <Dato etiqueta="Empresa">{c.usuario.empresa}</Dato> : null}
        <Dato etiqueta="Cargado">{formatoFechaHora(c.cargadaEn)}</Dato>
      </dl>
      <div className="flex justify-end">
        <BotonEliminarCampo modo="texto" etiqueta={`Eliminar ${c.producto}`} onClick={onEliminar} />
      </div>
    </div>
  );
}

/** Un estado: se despliega de a uno y pagina por su cuenta. */
function SeccionEstado({
  titulo,
  punto,
  lista,
  abierta,
  onAlternar,
  conEmpresa,
  onEliminar,
}: {
  titulo: string;
  punto: string;
  lista: ListaCargas;
  abierta: boolean;
  onAlternar: () => void;
  conEmpresa: boolean;
  onEliminar: (c: CargaInventarioFila) => void;
}) {
  const panel = useId();
  const [detalle, setDetalle] = useState<number | null>(null);
  const alternar = (id: number) => setDetalle((d) => (d === id ? null : id));
  const total = lista.datos?.total;

  return (
    <section data-inicio-listado className="min-w-0 scroll-mt-20 border-t border-line first:border-t-0">
      <h2>
        <button
          type="button"
          aria-expanded={abierta}
          aria-controls={panel}
          onClick={onAlternar}
          className={`flex min-h-12 w-full cursor-pointer items-center gap-2.5 px-4 text-left text-xs font-bold uppercase tracking-wider text-foreground transition-colors hover:bg-surface-soft ${FOCO}`}
        >
          <span aria-hidden="true" className={`h-2.5 w-2.5 shrink-0 rounded-full ${punto}`} />
          <span className="min-w-0 flex-1">{titulo}</span>
          <span className="font-mono text-muted">{total ?? "…"}</span>
          <IconoChevronAbajo
            className={`h-4 w-4 shrink-0 text-muted transition-transform ${abierta ? "rotate-180" : ""}`}
          />
        </button>
      </h2>
      <div id={panel} hidden={!abierta} className="min-w-0 border-t border-line">
        {lista.error ? (
          <div className={`${errorBox} m-3`}>
            {lista.error}{" "}
            <button type="button" className={btnGhost} onClick={lista.refrescar}>
              Reintentar
            </button>
          </div>
        ) : null}
        {lista.cargando ? (
          <SkeletonFilas etiqueta={`Cargando ${titulo.toLowerCase()}`} className="px-4 py-3" />
        ) : (
          <>
            <table className="hidden w-full text-left text-sm md:table">
              <caption className="sr-only">{titulo}</caption>
              <thead className="text-[11px] uppercase tracking-wider text-muted">
                <tr>
                  {["Faltan", "Producto", "Local", "Cargado por", "Cantidad", "Vence"].map((t) => (
                    <th key={t} className="px-4 py-2 font-semibold">
                      {t}
                    </th>
                  ))}
                  <th className="w-14">
                    <span className="sr-only">Detalle</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {lista.items.map((c) => {
                  const visible = detalle === c.id;
                  return (
                    <Fragment key={c.id}>
                      <tr
                        onClick={() => alternar(c.id)}
                        className={`cursor-pointer border-t border-line transition-colors hover:bg-surface-soft ${visible ? "bg-surface-soft" : ""}`}
                      >
                        <td className="px-4 py-2.5">
                          <Dias c={c} />
                        </td>
                        <td className="px-4 py-2.5">
                          <Producto c={c} />
                        </td>
                        <td className="px-4 py-2.5 text-foreground">{c.local.nombre}</td>
                        <td className="px-4 py-2.5">
                          <Persona c={c} conEmpresa={conEmpresa} />
                        </td>
                        <td className="px-4 py-2.5 font-mono text-foreground">{c.cantidad}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-xs text-foreground">
                          {fechaCorta(c.vencimiento)}
                        </td>
                        <td className="px-1">
                          <button
                            type="button"
                            aria-expanded={visible}
                            aria-label={`${visible ? "Ocultar" : "Ver"} detalle de ${c.producto}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              alternar(c.id);
                            }}
                            className={`grid h-11 w-11 cursor-pointer place-items-center rounded-lg text-muted ${FOCO}`}
                          >
                            <IconoChevronAbajo
                              className={`h-4 w-4 transition-transform ${visible ? "rotate-180" : ""}`}
                            />
                          </button>
                        </td>
                      </tr>
                      {visible ? (
                        <tr>
                          <td colSpan={7} className="p-0">
                            <Detalle c={c} conEmpresa={conEmpresa} onEliminar={() => onEliminar(c)} />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            <ul className="md:hidden" aria-label={titulo}>
              {lista.items.map((c) => {
                const visible = detalle === c.id;
                return (
                  <li key={c.id} className="min-w-0 border-t border-line first:border-t-0">
                    <button
                      type="button"
                      aria-expanded={visible}
                      onClick={() => alternar(c.id)}
                      className={`flex min-h-14 w-full min-w-0 cursor-pointer items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-soft ${visible ? "bg-surface-soft" : ""} ${FOCO}`}
                    >
                      <Dias c={c} />
                      <span className="min-w-0 flex-1">
                        <span className="block break-words text-sm font-semibold text-foreground">
                          {c.producto}
                        </span>
                        <span className="block truncate text-xs text-muted">
                          {c.local.nombre} · {c.cantidad} u.
                        </span>
                      </span>
                      <IconoChevronAbajo
                        className={`h-4 w-4 shrink-0 text-muted transition-transform ${visible ? "rotate-180" : ""}`}
                      />
                    </button>
                    {visible ? (
                      <Detalle c={c} conEmpresa={conEmpresa} onEliminar={() => onEliminar(c)} />
                    ) : null}
                  </li>
                );
              })}
            </ul>
            {!lista.error && total === 0 ? (
              <p className="px-4 py-4 text-center text-sm text-muted">
                Sin {titulo.toLowerCase()} en esta búsqueda.
              </p>
            ) : null}
          </>
        )}
        {lista.datos && lista.datos.total > 0 ? (
          <div className="border-t border-line px-4 pb-3">
            <Paginacion
              {...lista.datos}
              onPageChange={lista.setPage}
              onLimitChange={lista.setLimit}
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}

/** Inventario cargado por la persona y su equipo, según su lugar en el organigrama. */
export function InventariosPanel() {
  const hoy = fechaEnZonaIso(new Date());
  const panelFiltros = useId();
  const [filtros, setFiltros] = useState<FiltrosCargaInventario>(() => ({
    ...SIN_FILTROS,
    periodo: periodosDesdeHoy(hoy)[0],
  }));
  // Entra mostrando el período inicial; después, lo elegido solo consulta al tocar Buscar.
  const [aplicados, setAplicados] = useState(filtros);
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  // En celular los filtros son una hoja que sube desde abajo.
  const hojaRef = useRef<HTMLDivElement>(null);
  const fondoRef = useRef<HTMLDivElement>(null);
  const hoja = useHojaDeslizable({
    abierto: filtrosAbiertos,
    panelRef: hojaRef,
    fondoRef,
    onMinimizar: () => setFiltrosAbiertos(false),
  });
  const cerrarFiltros = () => (hoja.activa ? hoja.minimizar() : setFiltrosAbiertos(false));
  useEffect(() => {
    if (!filtrosAbiertos) return;
    const conEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFiltrosAbiertos(false);
    };
    document.addEventListener("keydown", conEscape);
    return () => document.removeEventListener("keydown", conEscape);
  }, [filtrosAbiertos]);
  // De a un estado por vez: abrir uno esconde los otros.
  // `undefined`: todavía no eligió la persona y se abre lo más urgente que haya.
  const [elegida, setElegida] = useState<EstadoCargaInventario | null>();
  const [puedeConfigurarAvisos, setPuedeConfigurarAvisos] = useState(false);
  const [avisosAbierto, setAvisosAbierto] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [exportando, setExportando] = useState(false);

  useEffect(() => {
    const control = new AbortController();
    apiFetch("/campo/inventario/configuracion", { signal: control.signal })
      .then(() => setPuedeConfigurarAvisos(true))
      // Sin permiso la API responde 403 y el botón no se muestra.
      .catch(() => undefined);
    return () => control.abort();
  }, []);
  const cambiar = (cambios: Partial<FiltrosCargaInventario>) =>
    setFiltros((f) => ({ ...f, ...cambios }));

  const consulta = new URLSearchParams(
    aplicados.periodo ? rangoPeriodoInicio(aplicados.periodo, hoy) : {},
  );
  if (aplicados.empresaId !== "") consulta.set("empresaId", String(aplicados.empresaId));
  if (aplicados.equipoId !== "") consulta.set("equipoId", String(aplicados.equipoId));
  if (aplicados.responsableId !== "") consulta.set("responsableId", String(aplicados.responsableId));
  const urlDe = (estado: EstadoCargaInventario) => {
    const q = new URLSearchParams(consulta);
    q.set("estado", estado);
    return `${BASE}?${q}`;
  };
  // La primera página de cada estado da también su conteo.
  const listas: Record<EstadoCargaInventario, ListaCargas> = {
    VENCIDO: useListaCampo<CargaInventarioFila>(urlDe("VENCIDO"), 0, 7),
    POR_VENCER: useListaCampo<CargaInventarioFila>(urlDe("POR_VENCER"), 0, 7),
    VIGENTE: useListaCampo<CargaInventarioFila>(urlDe("VIGENTE"), 0, 7),
  };
  const todas = SECCIONES.map((s) => listas[s.estado]);
  const total = todas.reduce((n, l) => n + (l.datos?.total ?? 0), 0);
  const sinNada = todas.every((l) => !l.cargando && !l.error && l.datos?.total === 0);
  const abierta =
    elegida !== undefined
      ? elegida
      : todas.some((l) => l.cargando)
        ? "VENCIDO"
        : (SECCIONES.find((s) => listas[s.estado].datos?.total)?.estado ?? null);

  async function eliminar(c: CargaInventarioFila) {
    if (
      !(await confirmar({
        titulo: "Eliminar carga",
        mensaje: `¿Eliminar ${c.producto} de ${c.local.nombre}, cargado por ${c.usuario.nombre}? Deja de verse en el inventario.`,
        textoConfirmar: "Eliminar",
        peligro: true,
      }))
    )
      return;
    setEliminando(true);
    try {
      await apiFetch<null>(`${BASE}/${c.id}`, { method: "DELETE" });
      mostrarToast("exito", "Carga eliminada");
      const lista = listas[c.estado];
      // Su sección sigue abierta mientras se actualiza.
      setElegida(c.estado);
      // Era la última de su página: se vuelve a la anterior.
      if (lista.items.length === 1 && lista.page > 1) lista.setPage(lista.page - 1);
      lista.refrescar();
    } catch (e) {
      mostrarToast("error", e instanceof Error ? e.message : "No se pudo eliminar la carga");
    } finally {
      setEliminando(false);
    }
  }

  // Lleva todo lo que da la búsqueda aplicada (los tres estados), no solo lo que se ve.
  async function exportar() {
    setExportando(true);
    try {
      await descargarArchivo(`${BASE}/exportar?${consulta}`, `inventario-${hoy}.csv`);
    } catch (e) {
      mostrarToast("error", e instanceof Error ? e.message : "No se pudo exportar a Excel");
    } finally {
      setExportando(false);
    }
  }

  const buscar = () => {
    if (!filtros.periodo) return;
    setAplicados(filtros);
    setElegida(undefined);
    todas.forEach((l) => {
      l.setPage(1);
      l.refrescar();
    });
    setFiltrosAbiertos(false);
  };

  // Solo se ofrece filtrar lo que tiene más de una opción para este rol.
  const empresas = useListaCampo<{ id: number }>(`${BASE}/empresas`, 0, 1);
  const conEmpresa = (empresas.datos?.total ?? 0) > 0;
  const deEmpresa = filtros.empresaId !== "" ? `empresaId=${filtros.empresaId}` : "";
  const urlEquipos = `${BASE}/equipos${deEmpresa ? `?${deEmpresa}` : ""}`;
  const urlPersonas = `${BASE}/responsables${deEmpresa ? `?${deEmpresa}` : ""}`;
  const equipos = useListaCampo<{ id: number }>(urlEquipos, 0, 1);
  const personas = useListaCampo<{ id: number }>(urlPersonas, 0, 1);
  const urlResponsables = `${urlPersonas}${filtros.equipoId !== "" ? `${deEmpresa ? "&" : "?"}equipoId=${filtros.equipoId}` : ""}`;

  const filtrosExtra = [aplicados.empresaId, aplicados.equipoId, aplicados.responsableId].filter(
    (v) => v !== "",
  ).length;
  const resumenFiltros = [
    aplicados.periodo?.etiqueta,
    filtrosExtra ? `${filtrosExtra} ${filtrosExtra === 1 ? "filtro" : "filtros"}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section
      className="campo-screen w-full min-w-0 space-y-4 p-4 sm:p-6 lg:p-8"
      aria-label="Inventario"
    >
      <PantallaCarga visible={eliminando} mensaje="Eliminando carga" />
      <PantallaCarga visible={exportando} mensaje="Exportando a Excel" />
      <div className="flex min-w-0 items-center justify-between gap-3">
        <h1 className="ft-display text-2xl font-semibold text-foreground">Inventario</h1>
        <div className="flex shrink-0 items-center gap-2">
          {puedeConfigurarAvisos ? (
            <button
              type="button"
              aria-label="Avisos de vencimiento"
              title="Avisos de vencimiento del inventario"
              onClick={() => setAvisosAbierto(true)}
              className={BOTON_CABECERA}
            >
              <IconoCalendario className="h-4 w-4" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void exportar()}
            disabled={exportando || !total}
            title="Descarga todos los registros de la búsqueda para abrirlos en Excel"
            className={BOTON_CABECERA}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5 text-emerald-700 dark:text-emerald-400"
              aria-hidden="true"
            >
              <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
              <path d="M14 3v5h5" />
              <path d="m9.5 12 5 6m0-6-5 6" />
            </svg>
            Exportar
          </button>
        </div>
      </div>
      {/* En celular los filtros quedan en una línea que abre la hoja; en escritorio siempre a la vista. */}
      <button
        type="button"
        aria-expanded={filtrosAbiertos}
        aria-controls={panelFiltros}
        onClick={() => setFiltrosAbiertos((v) => !v)}
        className={`flex min-h-11 w-full min-w-0 cursor-pointer items-center gap-2.5 rounded-xl border border-line bg-surface-raised px-3.5 text-left text-sm font-semibold text-foreground transition-colors hover:bg-surface-soft md:hidden ${FOCO}`}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="h-4 w-4 shrink-0"
        >
          <path d="M3 6h18M7 12h10M10 18h4" />
        </svg>
        <span className="min-w-0 flex-1 truncate">{resumenFiltros}</span>
        <IconoChevronAbajo
          className={`h-4 w-4 shrink-0 text-muted transition-transform ${filtrosAbiertos ? "rotate-180" : ""}`}
        />
      </button>
      {filtrosAbiertos ? (
        <div
          ref={fondoRef}
          aria-hidden="true"
          onClick={cerrarFiltros}
          className="fixed inset-0 z-[60] !mt-0 bg-black/40 sm:hidden"
        />
      ) : null}
      {/* Se oculta sin desmontar: los selectores conservan lo elegido. La hoja solo crece mientras una lista está abierta, para que entre. */}
      <div
        ref={hojaRef}
        id={panelFiltros}
        className={
          filtrosAbiertos
            ? "max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:z-[61] max-sm:!mt-0 max-sm:flex max-sm:max-h-[90dvh] max-sm:has-[[role=listbox]]:min-h-[70dvh] max-sm:flex-col max-sm:overflow-y-auto max-sm:rounded-t-2xl max-sm:border max-sm:border-line max-sm:bg-surface-raised max-sm:p-4 max-sm:pb-[calc(1rem+env(safe-area-inset-bottom))] max-sm:shadow-2xl max-sm:motion-safe:animate-hoja-subir"
            : "hidden md:block"
        }
      >
        <div
          {...hoja.arrastre}
          className="touch-none select-none pb-3 sm:hidden"
        >
          <span aria-hidden="true" className="mx-auto mb-3 block h-1 w-10 rounded-full bg-line" />
          <p className="text-base font-bold text-foreground">Filtros</p>
        </div>
        <div className="flex min-w-0 flex-col gap-3 max-sm:flex-1 md:flex-row md:flex-wrap md:items-end">
          {/* Solo crece en la fila de escritorio: en columna estiraría los selectores a lo alto. */}
          <div className="grid min-w-0 grid-cols-1 gap-3 empty:hidden sm:grid-cols-2 md:flex-1 lg:grid-cols-3">
            {conEmpresa ? (
              <SelectorPaginado
                url={`${BASE}/empresas`}
                etiqueta="Empresa"
                value={filtros.empresaId}
                buscable
                limpiable
                placeholder="Todas las empresas"
                onChange={(id) => cambiar({ empresaId: id, equipoId: "", responsableId: "" })}
              />
            ) : null}
            {equipos.error || (equipos.datos?.total ?? 0) > 1 ? (
              <SelectorPaginado
                key={urlEquipos}
                url={urlEquipos}
                etiqueta="Equipo"
                value={filtros.equipoId}
                buscable
                limpiable
                placeholder="Todos los equipos"
                onChange={(id) => cambiar({ equipoId: id, responsableId: "" })}
              />
            ) : null}
            {personas.error || (personas.datos?.total ?? 0) > 1 ? (
              <SelectorPaginado
                key={urlResponsables}
                url={urlResponsables}
                etiqueta="Responsable"
                value={filtros.responsableId}
                buscable
                limpiable
                placeholder="Todo mi equipo"
                onChange={(id) => cambiar({ responsableId: id })}
              />
            ) : null}
          </div>
          <div className="min-w-0 max-sm:order-first">
            <SelectorFechaFiltro
              valorActual={filtros.periodo ?? SIN_PERIODO}
              periodos={periodosInventario}
              onChange={(periodo) => cambiar({ periodo })}
            />
          </div>
          <div className="flex w-full shrink-0 gap-2 max-sm:mt-auto md:ml-auto md:w-auto">
            <button type="button" className={`${btnGhost} flex-1 sm:hidden`} onClick={cerrarFiltros}>
              Cancelar
            </button>
            <button
              type="button"
              className={`${btnPrimary} flex-1 cursor-pointer`}
              disabled={!filtros.periodo}
              onClick={buscar}
            >
              Buscar
            </button>
          </div>
        </div>
      </div>
      {sinNada ? (
        <p className="rounded-2xl border border-line bg-surface-raised p-6 text-center text-sm text-muted">
          Nada cargado en este período. Probá con otro período u otro filtro.
        </p>
      ) : (
        <div className="min-w-0 overflow-hidden rounded-2xl border border-line bg-surface-raised">
          {SECCIONES.map((s) => (
            <SeccionEstado
              key={s.estado}
              titulo={s.titulo}
              punto={s.punto}
              lista={listas[s.estado]}
              abierta={abierta === s.estado}
              onAlternar={() => setElegida(abierta === s.estado ? null : s.estado)}
              conEmpresa={conEmpresa}
              onEliminar={(c) => void eliminar(c)}
            />
          ))}
        </div>
      )}
      {avisosAbierto ? (
        <ConfigVencimientosModal onCerrar={() => setAvisosAbierto(false)} />
      ) : null}
    </section>
  );
}
