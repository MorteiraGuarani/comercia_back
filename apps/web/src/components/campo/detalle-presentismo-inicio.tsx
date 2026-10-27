"use client";

import { useState } from "react";
import { Paginacion } from "@/components/paginacion";
import type { ColaboradorResumen, SupervisionResumenData } from "@/types/campo";
import type { EstadoPresentismo } from "@/types/estado-jornada";
import { pct } from "@/utils/hoy-en-campo";
import { ConteosFiltro, PRESENTISMO_UI, enfoqueTablero } from "./ui/tablero-campo";
import { IconoTelefono } from "./ui/iconos-campo";

const ESTADOS = ["PRESENTE", "TARDE", "INCOMPLETO", "AUSENTE"] as const;

export function DetallePresentismoInicio({
  resumen,
  equipo,
  onAbrir,
}: {
  resumen: SupervisionResumenData;
  equipo: ColaboradorResumen[];
  onAbrir: (id: number) => void;
}) {
  const [filtro, setFiltro] = useState<EstadoPresentismo | null>(null);
  const [pagina, setPagina] = useState(1);
  const [limit, setLimit] = useState(7);
  const totalEquipo = resumen.presentismo.totalEquipo;
  const filtrados = filtro
    ? equipo.filter((c) => c.estadoPresentismo === filtro)
    : equipo;
  const totalPages = Math.max(1, Math.ceil(filtrados.length / limit));
  const page = Math.min(pagina, totalPages);
  const items = filtrados.slice((page - 1) * limit, page * limit);

  return (
    <div className="min-w-0 space-y-3">
      <ConteosFiltro
        etiqueta="Filtrar marcaciones por estado"
        activo={filtro}
        onFiltro={(clave) => {
          setFiltro(ESTADOS.find((e) => e === clave) ?? null);
          setPagina(1);
        }}
        items={ESTADOS.map((estado) => {
          const cantidad = resumen.presentismo.estados[estado];
          const porcentaje = pct(cantidad, totalEquipo);
          const ui = PRESENTISMO_UI[estado];
          return {
            clave: estado,
            etiqueta: ui.etiqueta,
            valor: cantidad,
            detalle: `${porcentaje}%`,
            punto: ui.barra,
            descripcion: `${ui.etiqueta}: ${porcentaje}%, ${cantidad} de ${totalEquipo} personas. Filtrar marcaciones`,
          };
        })}
      />
      <section
        aria-label="Marcaciones del equipo"
        className="rounded-xl border border-line bg-surface-raised p-3 sm:p-4"
      >
        <div className="mb-2 flex min-w-0 items-center justify-between gap-2">
          <h3 className="text-xs font-bold text-foreground">
            Marcaciones{filtro ? ` · ${PRESENTISMO_UI[filtro].etiqueta}` : ""}{" "}
            <span className="font-normal text-muted">({filtrados.length})</span>
          </h3>
          {filtro ? (
            <button
              type="button"
              onClick={() => {
                setFiltro(null);
                setPagina(1);
              }}
              className={`min-h-11 cursor-pointer rounded px-2 text-xs font-semibold text-accent-ink hover:bg-surface-soft ${enfoqueTablero}`}
            >
              Ver todas
            </button>
          ) : null}
        </div>
        {items.length ? (
          <ul className="divide-y divide-line">
            {items.map((c) => (
              <li
                key={c.id}
                className="flex min-w-0 items-center gap-2 py-2 first:pt-0"
              >
                <button
                  type="button"
                  onClick={() => onAbrir(c.id)}
                  className={`min-h-11 min-w-0 flex-1 cursor-pointer truncate rounded text-left text-sm font-semibold text-foreground hover:underline ${enfoqueTablero}`}
                >
                  {c.nombre}
                </button>
                <span
                  className={`shrink-0 whitespace-nowrap rounded-md px-1.5 text-[11px] font-bold ${PRESENTISMO_UI[c.estadoPresentismo].pill}`}
                >
                  {PRESENTISMO_UI[c.estadoPresentismo].etiqueta}
                  {c.inicioJornada ? ` · ${c.inicioJornada}` : ""}
                </span>
                {c.estadoPresentismo === "AUSENTE" &&
                c.telefono.replace(/[^\d+]/g, "").length >= 6 ? (
                  <a
                    href={`tel:${c.telefono.replace(/[^\d+]/g, "")}`}
                    aria-label={`Llamar a ${c.nombre}`}
                    title={`Llamar a ${c.nombre}`}
                    className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg text-brand-700 hover:bg-surface-soft dark:text-brand-200 ${enfoqueTablero}`}
                  >
                    <IconoTelefono className="h-4 w-4" />
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-5 text-center text-sm text-muted">
            No hay marcaciones en este estado.
          </p>
        )}
        <Paginacion
          page={page}
          totalPages={totalPages}
          total={filtrados.length}
          limit={limit}
          onPageChange={setPagina}
          onLimitChange={(valor) => {
            setLimit(valor);
            setPagina(1);
          }}
          desplazarAlInicio={false}
        />
      </section>
    </div>
  );
}
