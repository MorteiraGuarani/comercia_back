"use client";

import { useState } from "react";
import { useListaCampo } from "@/hooks/use-lista-campo";
import { TablaCampo } from "@/components/campo/tabla-campo";
import { btnGhost } from "@/components/ui";
import { formatoFechaHora } from "@/utils/fechas";
import type { RegistroMarcacionCampo } from "@/types/campo";

type Resultado = RegistroMarcacionCampo["resultado"];

const FILTROS: { valor: Resultado | ""; texto: string }[] = [
  { valor: "", texto: "Todas" },
  { valor: "ACEPTADA", texto: "Aceptadas" },
  { valor: "RECHAZADA", texto: "Rechazadas" },
  { valor: "ERROR", texto: "Con error" },
];

const ESTILO: Record<Resultado, string> = {
  ACEPTADA:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300",
  RECHAZADA:
    "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300",
  ERROR:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300",
};

// Qué tipo de marca fue, según el endpoint.
const origen = (r: RegistroMarcacionCampo) =>
  `${r.tipo === "SALIDA" ? "Salida" : "Entrada"}${
    r.ruta.includes("marcas-sin-conexion") ? " · guardada sin conexión" : ""
  }${r.ruta.includes("/repositor/") ? " · con el teléfono" : ""}`;

function ResultadoMarca({ r }: { r: RegistroMarcacionCampo }) {
  return (
    <div className="min-w-0">
      <span
        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${ESTILO[r.resultado]}`}
      >
        {r.resultado}
      </span>
      <p className="mt-0.5 font-mono text-[11px] text-muted">
        HTTP {r.estadoHttp}
        {r.codigo ? ` · ${r.codigo}` : ""} · {r.duracionMs} ms
      </p>
    </div>
  );
}

function Usuario({ r }: { r: RegistroMarcacionCampo }) {
  return (
    <div className="min-w-0">
      <p className="text-sm font-bold text-foreground">
        {r.usuarioNombre || (r.usuarioId ? `Usuario ${r.usuarioId}` : "Sin identificar")}
      </p>
      <p className="truncate text-[11px] text-muted">
        {[r.usuarioLogin, r.usuarioCorreo, r.empresaNombre].filter(Boolean).join(" · ")}
      </p>
    </div>
  );
}

function Datos({ r }: { r: RegistroMarcacionCampo }) {
  return (
    <details className="mt-1 min-w-0">
      <summary className="inline-flex min-h-11 cursor-pointer items-center text-xs font-semibold text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus dark:text-brand-300">
        Ver pedido y respuesta
      </summary>
      <p className="font-mono text-[11px] text-muted">{r.ruta}</p>
      <pre className="mt-1 max-h-80 max-w-full overflow-auto rounded-lg border border-line bg-surface-soft p-2 font-mono text-[11px] text-foreground">
        {JSON.stringify({ solicitud: r.solicitud, respuesta: r.respuesta }, null, 2)}
      </pre>
    </details>
  );
}

/** Superadmin: cada pedido de marca de campo, quién lo hizo y cómo terminó. */
export function RegistroMarcacionesPanel() {
  const [resultado, setResultado] = useState<Resultado | "">("");
  const lista = useListaCampo<RegistroMarcacionCampo>(
    `/campo/superadmin/registro-marcaciones${resultado ? `?resultado=${resultado}` : ""}`,
    0,
    7,
  );
  return (
    <section className="campo-screen min-w-0 w-full space-y-4" aria-label="Registro de marcaciones">
      <div className="flex min-w-0 flex-wrap items-center gap-2" role="group" aria-label="Resultado">
        {FILTROS.map((f) => (
          <button
            key={f.texto}
            type="button"
            aria-pressed={resultado === f.valor}
            className={`${btnGhost} whitespace-nowrap ${resultado === f.valor ? "border-brand-500 bg-surface-soft" : ""}`}
            onClick={() => {
              setResultado(f.valor);
              lista.setPage(1);
            }}
          >
            {f.texto}
          </button>
        ))}
        <span className="shrink-0 whitespace-nowrap rounded-lg border border-line bg-surface-raised px-3 py-2 font-mono text-xs font-semibold text-foreground">
          {lista.datos?.total ?? "—"} marcas
        </span>
      </div>
      <TablaCampo
        lista={lista}
        etiqueta="Registro de marcaciones"
        columnas={[
          {
            titulo: "Cuándo",
            valor: (r) => (
              <span className="whitespace-nowrap text-xs text-foreground">
                {formatoFechaHora(r.creadoEn)}
              </span>
            ),
          },
          { titulo: "Resultado", valor: (r) => <ResultadoMarca r={r} /> },
          { titulo: "Usuario", valor: (r) => <Usuario r={r} /> },
          {
            titulo: "Marca",
            valor: (r) => <span className="text-xs text-foreground">{origen(r)}</span>,
          },
          {
            titulo: "Motivo y datos",
            valor: (r) => (
              <div className="min-w-0 max-w-md">
                <p className="break-words text-xs text-foreground">{r.motivo}</p>
                <Datos r={r} />
              </div>
            ),
          },
        ]}
        tarjetaMovil={(r) => (
          <div className="min-w-0 space-y-1.5 rounded-xl border border-line bg-surface-raised px-3 py-2.5">
            <div className="flex min-w-0 items-start justify-between gap-2">
              <Usuario r={r} />
              <ResultadoMarca r={r} />
            </div>
            <p className="text-xs text-foreground">{origen(r)}</p>
            <p className="break-words text-xs text-foreground">{r.motivo}</p>
            <p className="text-[11px] text-muted">{formatoFechaHora(r.creadoEn)}</p>
            <Datos r={r} />
          </div>
        )}
      />
    </section>
  );
}
