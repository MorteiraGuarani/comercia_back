"use client";

import { useEffect, useState } from "react";
import { SelectorPaginado } from "@/components/selector-paginado";
import { TablaCampo } from "@/components/campo/tabla-campo";
import { SelectorFechaFiltro } from "@/components/campo/ui/selector-fecha-filtro";
import { btnGhost, inputBase, labelBase } from "@/components/ui";
import { useListaCampo } from "@/hooks/use-lista-campo";
import type {
  CargaInventarioFila,
  EstadoCargaInventario,
} from "@/types/inventario-cargas";
import type { PeriodoFiltro } from "@/types/periodo-filtro";
import { fechaEnZonaIso, formatoFechaCalendario, formatoFechaHora } from "@/utils/fechas";
import { periodosInventario, rangoPeriodoInicio } from "@/utils/periodo-inicio";

const BASE = "/campo/inventario/cargas";
const SIN_PERIODO: PeriodoFiltro = { clave: "", etiqueta: "" };

const ESTADOS: { valor: EstadoCargaInventario | ""; texto: string }[] = [
  { valor: "", texto: "Todos" },
  { valor: "VIGENTE", texto: "Vigentes" },
  { valor: "POR_VENCER", texto: "Por vencer" },
  { valor: "VENCIDO", texto: "Vencidos" },
];

const ESTILO_ESTADO: Record<EstadoCargaInventario, string> = {
  VIGENTE:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300",
  POR_VENCER:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300",
  VENCIDO:
    "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300",
};

const TEXTO_ESTADO: Record<EstadoCargaInventario, string> = {
  VIGENTE: "Vigente",
  POR_VENCER: "Por vencer",
  VENCIDO: "Vencido",
};

function Estado({ c }: { c: CargaInventarioFila }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold ${ESTILO_ESTADO[c.estado]}`}
    >
      {TEXTO_ESTADO[c.estado]}
    </span>
  );
}

function Persona({ c, conEmpresa }: { c: CargaInventarioFila; conEmpresa: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-sm font-bold text-foreground">{c.usuario.nombre}</p>
      <p className="truncate text-[11px] text-muted">
        {[conEmpresa ? c.usuario.empresa : null, c.usuario.rol, c.usuario.equipo]
          .filter(Boolean)
          .join(" · ")}
      </p>
    </div>
  );
}

function Producto({ c }: { c: CargaInventarioFila }) {
  return (
    <div className="min-w-0">
      <p className="break-words text-sm text-foreground">{c.producto}</p>
      <p className="font-mono text-[11px] text-muted">{c.itemcode}</p>
    </div>
  );
}

const fechaCorta = (iso: string) => formatoFechaCalendario(iso) ?? iso;

/** Inventarios cargados por la persona y su equipo, según su lugar en el organigrama. */
export function InventariosPanel() {
  const hoy = fechaEnZonaIso(new Date());
  // Sin fecha elegida no se consulta nada.
  const [periodo, setPeriodo] = useState<PeriodoFiltro | null>(null);
  const [estado, setEstado] = useState<EstadoCargaInventario | "">("");
  const [empresaId, setEmpresaId] = useState<number | "">("");
  const [equipoId, setEquipoId] = useState<number | "">("");
  const [responsableId, setResponsableId] = useState<number | "">("");
  const [texto, setTexto] = useState("");
  const [buscar, setBuscar] = useState("");

  const consulta = new URLSearchParams(
    periodo ? rangoPeriodoInicio(periodo, hoy) : {},
  );
  if (estado) consulta.set("estado", estado);
  if (empresaId !== "") consulta.set("empresaId", String(empresaId));
  if (equipoId !== "") consulta.set("equipoId", String(equipoId));
  if (responsableId !== "") consulta.set("responsableId", String(responsableId));
  if (buscar) consulta.set("buscar", buscar);
  const lista = useListaCampo<CargaInventarioFila>(
    `${BASE}?${consulta}`,
    0,
    7,
    periodo !== null,
  );
  const { setPage } = lista;

  useEffect(() => {
    const espera = setTimeout(() => {
      setBuscar(texto.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(espera);
  }, [texto, setPage]);

  // Solo se ofrece filtrar lo que tiene más de una opción para este rol.
  // El superadmin elige empresa antes de filtrar por equipo o persona.
  const empresas = useListaCampo<{ id: number }>(`${BASE}/empresas`, 0, 1);
  const conEmpresa = (empresas.datos?.total ?? 0) > 0;
  const deEmpresa = empresaId !== "" ? `empresaId=${empresaId}` : "";
  const urlEquipos = `${BASE}/equipos${deEmpresa ? `?${deEmpresa}` : ""}`;
  const urlPersonas = `${BASE}/responsables${deEmpresa ? `?${deEmpresa}` : ""}`;
  const equipos = useListaCampo<{ id: number }>(urlEquipos, 0, 1);
  const personas = useListaCampo<{ id: number }>(urlPersonas, 0, 1);
  const urlResponsables = `${urlPersonas}${equipoId !== "" ? `${deEmpresa ? "&" : "?"}equipoId=${equipoId}` : ""}`;
  const filtraPersonas = !conEmpresa || empresaId !== "";

  return (
    <section
      className="campo-screen w-full min-w-0 space-y-4 p-4 sm:p-6 lg:p-8"
      aria-label="Inventarios"
    >
      <h1 className="ft-display text-2xl font-semibold text-foreground">Inventarios</h1>
      <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:items-end">
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {conEmpresa ? (
            <SelectorPaginado
              url={`${BASE}/empresas`}
              etiqueta="Empresa"
              value={empresaId}
              buscable
              limpiable
              placeholder="Todas las empresas"
              onChange={(id) => {
                setEmpresaId(id);
                setEquipoId("");
                setResponsableId("");
                setPage(1);
              }}
            />
          ) : null}
          {filtraPersonas && (equipos.datos?.total ?? 0) > 1 ? (
            <SelectorPaginado
              key={urlEquipos}
              url={urlEquipos}
              etiqueta="Equipo"
              value={equipoId}
              buscable
              limpiable
              placeholder="Todos los equipos"
              onChange={(id) => {
                setEquipoId(id);
                setResponsableId("");
                setPage(1);
              }}
            />
          ) : null}
          {filtraPersonas && (personas.datos?.total ?? 0) > 1 ? (
            <SelectorPaginado
              key={urlResponsables}
              url={urlResponsables}
              etiqueta="Responsable"
              value={responsableId}
              buscable
              limpiable
              placeholder="Todo mi equipo"
              onChange={(id) => {
                setResponsableId(id);
                setPage(1);
              }}
            />
          ) : null}
          <label className={`${labelBase} min-w-0`}>
            Local o producto
            <input
              type="search"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              maxLength={120}
              placeholder="Buscar"
              className={inputBase}
            />
          </label>
        </div>
        <SelectorFechaFiltro
          valorActual={periodo ?? SIN_PERIODO}
          periodos={periodosInventario}
          onChange={(p) => {
            setPeriodo(p);
            setPage(1);
          }}
        />
        <div className="flex min-w-0 flex-wrap items-center gap-1.5" role="group" aria-label="Estado">
          {ESTADOS.map((e) => (
            <button
              key={e.texto}
              type="button"
              aria-pressed={estado === e.valor}
              className={`${btnGhost} whitespace-nowrap ${estado === e.valor ? "border-brand-500 bg-surface-soft" : ""}`}
              onClick={() => {
                setEstado(e.valor);
                setPage(1);
              }}
            >
              {e.texto}
            </button>
          ))}
        </div>
      </div>
      {!periodo ? (
        <p className="rounded-2xl border border-line bg-surface-raised p-6 text-center text-sm text-muted">
          Elegí una fecha para ver los inventarios.
        </p>
      ) : (
      <TablaCampo
        lista={lista}
        etiqueta="Inventarios"
        columnas={[
          { titulo: "Fecha", valor: (c) => <span className="whitespace-nowrap text-xs text-foreground">{fechaCorta(c.fecha)}</span> },
          { titulo: "Cargado por", valor: (c) => <Persona c={c} conEmpresa={conEmpresa} /> },
          { titulo: "Local", valor: (c) => <span className="text-sm text-foreground">{c.local.nombre}</span> },
          { titulo: "Producto", valor: (c) => <Producto c={c} /> },
          { titulo: "Cantidad", valor: (c) => <span className="font-mono text-sm text-foreground">{c.cantidad}</span> },
          { titulo: "Vence", valor: (c) => <span className="whitespace-nowrap text-xs text-foreground">{fechaCorta(c.vencimiento)}</span> },
          { titulo: "Estado", valor: (c) => <Estado c={c} /> },
        ]}
        tarjetaMovil={(c) => (
          <div className="min-w-0 space-y-1.5 rounded-xl border border-line bg-surface-raised px-3 py-2.5">
            <div className="flex min-w-0 items-start justify-between gap-2">
              <Producto c={c} />
              <Estado c={c} />
            </div>
            <p className="text-xs text-foreground">{c.local.nombre}</p>
            <p className="text-xs text-foreground">
              Cantidad <span className="font-mono">{c.cantidad}</span> · Vence {fechaCorta(c.vencimiento)}
            </p>
            <Persona c={c} conEmpresa={conEmpresa} />
            <p className="text-[11px] text-muted">{formatoFechaHora(c.cargadaEn)}</p>
          </div>
        )}
      />
      )}
    </section>
  );
}
