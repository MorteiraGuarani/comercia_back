"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { apiFetch } from "@/lib/api";
import { SelectorPaginado } from "@/components/selector-paginado";
import { ConfigVencimientosModal } from "@/components/campo/config-vencimientos-modal";
import { TablaCampo } from "@/components/campo/tabla-campo";
import { IconoCalendario } from "@/components/campo/ui/iconos-campo";
import {
  BOTON_FILTRO_COMPACTO,
  SelectorFechaFiltro,
} from "@/components/campo/ui/selector-fecha-filtro";
import { btnPrimary } from "@/components/ui";
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

const ESTADOS: {
  valor: EstadoCargaInventario | "";
  texto: string;
  apagado: string;
  activo: string;
}[] = [
  {
    valor: "",
    texto: "Todos",
    apagado: "border-line bg-surface-raised text-foreground",
    activo:
      "border-brand-700 bg-brand-700 text-white dark:border-brand-600 dark:bg-brand-700 dark:text-white",
  },
  {
    valor: "VIGENTE",
    texto: "Vigentes",
    apagado: ESTILO_ESTADO.VIGENTE,
    activo:
      "border-emerald-700 bg-emerald-700 text-white dark:border-emerald-700 dark:bg-emerald-800 dark:text-emerald-50",
  },
  {
    valor: "POR_VENCER",
    texto: "Por vencer",
    apagado: ESTILO_ESTADO.POR_VENCER,
    activo:
      "border-amber-700 bg-amber-700 text-white dark:border-amber-700 dark:bg-amber-800 dark:text-amber-50",
  },
  {
    valor: "VENCIDO",
    texto: "Vencidos",
    apagado: ESTILO_ESTADO.VENCIDO,
    activo:
      "border-red-700 bg-red-700 text-white dark:border-red-700 dark:bg-red-800 dark:text-red-50",
  },
];

const CHIP = `${BOTON_FILTRO_COMPACTO} cursor-pointer whitespace-nowrap rounded-full border font-semibold transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus dark:hover:brightness-125`;

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

// El rol y el equipo a veces se llaman igual: no repetir.
const puestoDe = (c: CargaInventarioFila) =>
  [...new Set([c.usuario.rol, c.usuario.equipo].filter(Boolean))].join(" · ");

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
      <p className="break-words text-sm text-foreground">{c.producto}</p>
      <p className="font-mono text-[11px] text-muted">{c.itemcode}</p>
    </div>
  );
}

const fechaCorta = (iso: string) => formatoFechaCalendario(iso) ?? iso;

function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted">{etiqueta}</dt>
      <dd className="min-w-0 break-words text-foreground">{children}</dd>
    </>
  );
}

/** En celular, lo esencial a la vista y el resto en Detalle. */
function TarjetaCarga({ c, conEmpresa }: { c: CargaInventarioFila; conEmpresa: boolean }) {
  const puesto = puestoDe(c);
  return (
    <div className="min-w-0 rounded-xl border border-line bg-surface-raised">
      <div className="min-w-0 space-y-2 px-3 py-2.5">
        <Producto c={c} />
        <div className="flex min-w-0 items-center justify-between gap-2">
          <p className="min-w-0 break-words text-xs text-foreground">{c.usuario.nombre}</p>
          <span
            className={`shrink-0 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold ${ESTILO_ESTADO[c.estado]}`}
          >
            Vence {fechaCorta(c.vencimiento)}
          </span>
        </div>
      </div>
      <details className="group min-w-0">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-b-xl border-t border-line px-3 text-xs font-semibold text-foreground transition-colors hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus group-open:rounded-none [&::-webkit-details-marker]:hidden">
        Detalle
        <svg
          aria-hidden="true"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="transition-transform group-open:rotate-180"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </summary>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 border-t border-line px-3 py-2.5 text-xs">
        <Dato etiqueta="Local">{c.local.nombre}</Dato>
        <Dato etiqueta="Cantidad">
          <span className="font-mono">{c.cantidad}</span>
        </Dato>
        <Dato etiqueta="Estado">
          <Estado c={c} />
        </Dato>
        <Dato etiqueta="Puesto">{puesto}</Dato>
        {conEmpresa ? <Dato etiqueta="Empresa">{c.usuario.empresa}</Dato> : null}
        <Dato etiqueta="Cargado">{formatoFechaHora(c.cargadaEn)}</Dato>
      </dl>
      </details>
    </div>
  );
}

/** Inventarios cargados por la persona y su equipo, según su lugar en el organigrama. */
export function InventariosPanel() {
  const hoy = fechaEnZonaIso(new Date());
  const panelFiltros = useId();
  const [filtros, setFiltros] = useState<FiltrosCargaInventario>(() => ({
    ...SIN_FILTROS,
    periodo: periodosDesdeHoy(hoy)[0],
  }));
  // Lo elegido solo consulta al tocar Buscar.
  const [aplicados, setAplicados] = useState<FiltrosCargaInventario | null>(null);
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(true);
  const [puedeConfigurarAvisos, setPuedeConfigurarAvisos] = useState(false);
  const [avisosAbierto, setAvisosAbierto] = useState(false);

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
    aplicados?.periodo ? rangoPeriodoInicio(aplicados.periodo, hoy) : {},
  );
  if (aplicados?.estado) consulta.set("estado", aplicados.estado);
  if (aplicados && aplicados.empresaId !== "") consulta.set("empresaId", String(aplicados.empresaId));
  if (aplicados && aplicados.equipoId !== "") consulta.set("equipoId", String(aplicados.equipoId));
  if (aplicados && aplicados.responsableId !== "") consulta.set("responsableId", String(aplicados.responsableId));
  const lista = useListaCampo<CargaInventarioFila>(
    `${BASE}?${consulta}`,
    0,
    7,
    aplicados !== null,
  );

  const buscar = () => {
    if (!filtros.periodo) return;
    setAplicados(filtros);
    lista.setPage(1);
    lista.refrescar();
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

  return (
    <section
      className="campo-screen w-full min-w-0 space-y-4 p-4 sm:p-6 lg:p-8"
      aria-label="Inventarios"
    >
      <div className="flex min-w-0 items-center justify-between gap-3">
        <h1 className="ft-display text-2xl font-semibold text-foreground">Inventarios</h1>
        <div className="flex shrink-0 items-center gap-2">
        {puedeConfigurarAvisos ? (
          <button
            type="button"
            aria-label="Avisos de vencimiento"
            title="Avisos de vencimiento del inventario"
            onClick={() => setAvisosAbierto(true)}
            className={`${CHIP} inline-flex min-w-9 items-center justify-center border-line bg-surface-raised text-foreground`}
          >
            <IconoCalendario className="h-4 w-4" />
          </button>
        ) : null}
        <button
          type="button"
          aria-expanded={filtrosAbiertos}
          aria-controls={panelFiltros}
          onClick={() => setFiltrosAbiertos((v) => !v)}
          aria-label={filtrosAbiertos ? "Esconder filtros" : "Mostrar filtros"}
          title={filtrosAbiertos ? "Esconder filtros" : "Mostrar filtros"}
          className={`${CHIP} inline-flex min-w-9 shrink-0 items-center justify-center border-line bg-surface-raised text-foreground`}
        >
          <svg
            aria-hidden="true"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`transition-transform ${filtrosAbiertos ? "rotate-180" : ""}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        </div>
      </div>
      {/* Se oculta sin desmontar: los selectores conservan lo elegido. */}
      <div id={panelFiltros} hidden={!filtrosAbiertos}>
        <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:items-end">
          <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 empty:hidden sm:grid-cols-2 lg:grid-cols-3">
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
          <SelectorFechaFiltro
            valorActual={filtros.periodo ?? SIN_PERIODO}
            periodos={periodosInventario}
            onChange={(periodo) => cambiar({ periodo })}
          />
          <div className="grid min-w-0 grid-cols-4 gap-1 sm:flex sm:items-center" role="group" aria-label="Estado">
            {ESTADOS.map((e) => (
              <button
                key={e.texto}
                type="button"
                aria-pressed={filtros.estado === e.valor}
                className={`${CHIP} ${filtros.estado === e.valor ? e.activo : e.apagado}`}
                onClick={() => cambiar({ estado: e.valor })}
              >
                {e.texto}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={`${btnPrimary} w-full shrink-0 cursor-pointer xl:w-auto`}
            disabled={!filtros.periodo}
            onClick={buscar}
          >
            Buscar
          </button>
        </div>
      </div>
      {!aplicados ? (
        <p className="rounded-2xl border border-line bg-surface-raised p-6 text-center text-sm text-muted">
          Tocá Buscar para ver los inventarios.
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
        tarjetaMovil={(c) => <TarjetaCarga c={c} conEmpresa={conEmpresa} />}
      />
      )}
      {avisosAbierto ? (
        <ConfigVencimientosModal onCerrar={() => setAvisosAbierto(false)} />
      ) : null}
    </section>
  );
}
