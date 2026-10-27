"use client";

import { useEffect, useState } from "react";
import { SelectorPaginado } from "@/components/selector-paginado";
import { useListaCampo } from "@/hooks/use-lista-campo";
import { TablaCampo } from "@/components/campo/tabla-campo";
import { BuscadorCatalogo } from "@/components/campo/ui/filtros-catalogo";
import { TextoExpandible } from "@/components/campo/ui/texto-expandible";
import { IconoPin } from "@/components/campo/ui/iconos-campo";
import type { ClientePdv } from "@/types/campo";
import type { EmpresaCatalogo } from "@/types/producto";

/** Superadmin: locales (socios de negocio) de la empresa elegida y quién los atiende. */
export function LocalesEmpresaPanel() {
  const [empresa, setEmpresa] = useState<EmpresaCatalogo | null>(null);
  return (
    <section className="campo-screen min-w-0 w-full space-y-4" aria-label="Locales por empresa">
      <div className="min-w-0 sm:w-80 lg:w-96">
        <SelectorPaginado
          url="/admin/catalogo/empresas"
          etiqueta="Empresa"
          value={empresa?.id ?? ""}
          seleccionActual={empresa?.nombre}
          placeholder="Elegí una empresa"
          buscable
          required
          onChange={() => {}}
          onSeleccionar={(item) => setEmpresa({ id: item.id, nombre: item.nombre ?? "" })}
        />
      </div>
      {empresa ? (
        <LocalesDeEmpresa key={empresa.id} empresaId={empresa.id} />
      ) : (
        <div className="border border-dashed border-line px-4 py-12 text-center">
          <p className="font-semibold text-foreground">Elegí una empresa para empezar</p>
          <p className="mt-1 text-sm text-muted">
            Vas a ver sus locales, su dirección y quién los atiende hoy.
          </p>
        </div>
      )}
    </section>
  );
}

function Asignados({ local }: { local: ClientePdv }) {
  const asignaciones = local.asignaciones ?? [];
  return asignaciones.length ? (
    <div className="flex min-w-0 flex-wrap gap-1">
      {asignaciones.map((a) => (
        <span
          key={a.id}
          title={a.usuario.rol?.descripcion ?? undefined}
          className="inline-flex max-w-full items-center rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-900 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-200"
        >
          <span className="truncate">
            {a.usuario.nombre} {a.usuario.apellido}
          </span>
        </span>
      ))}
    </div>
  ) : (
    <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300">
      Sin asignar
    </span>
  );
}

function Ubicacion({ local }: { local: ClientePdv }) {
  return local.latitud !== null && local.longitud !== null ? (
    <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Cargada</span>
  ) : (
    <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">Sin ubicación</span>
  );
}

function LocalesDeEmpresa({ empresaId }: { empresaId: number }) {
  const [busqueda, setBusqueda] = useState("");
  const [buscar, setBuscar] = useState("");
  const parametros = new URLSearchParams({ empresaId: String(empresaId) });
  if (buscar) parametros.set("buscar", buscar);
  const lista = useListaCampo<ClientePdv>(`/campo/superadmin/locales?${parametros}`, 0, 7);
  const { setPage } = lista;
  useEffect(() => {
    const timer = setTimeout(() => {
      setBuscar(busqueda.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [busqueda, setPage]);

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex min-w-0 items-center gap-2">
        <BuscadorCatalogo
          valor={busqueda}
          onCambio={setBusqueda}
          placeholder="Buscar por nombre o código"
          etiqueta="Buscar local"
        />
        <span className="shrink-0 whitespace-nowrap rounded-lg border border-line bg-surface-raised px-3 py-2 font-mono text-xs font-semibold text-foreground">
          {lista.datos?.total ?? "—"} locales
        </span>
      </div>
      <TablaCampo
        lista={lista}
        etiqueta="Locales de la empresa"
        columnas={[
          {
            titulo: "Local",
            valor: (l) => (
              <div className="min-w-0 max-w-xs">
                <p className="text-sm font-bold text-foreground">
                  <TextoExpandible texto={l.nombre} />
                </p>
                <p className="font-mono text-[11px] text-muted">{l.id}</p>
              </div>
            ),
          },
          {
            titulo: "Dirección",
            valor: (l) =>
              l.direccion ? (
                <div className="min-w-0 max-w-xs text-xs text-muted">
                  <TextoExpandible texto={l.direccion} />
                </div>
              ) : (
                <span className="text-xs text-muted">Sin dirección</span>
              ),
          },
          { titulo: "Ubicación", valor: (l) => <Ubicacion local={l} /> },
          { titulo: "Atienden hoy", valor: (l) => <Asignados local={l} /> },
        ]}
        tarjetaMovil={(l) => (
          <div className="min-w-0 space-y-1.5 rounded-xl border border-line bg-surface-raised px-3 py-2.5">
            <div className="flex min-w-0 items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-foreground">
                  <TextoExpandible texto={l.nombre} />
                </p>
                <p className="font-mono text-[11px] text-muted">{l.id}</p>
              </div>
              <Ubicacion local={l} />
            </div>
            <p className="flex min-w-0 items-start gap-1 text-xs text-muted">
              <IconoPin className="mt-px h-3.5 w-3.5 shrink-0" />
              {l.direccion ? <TextoExpandible texto={l.direccion} /> : <span>Sin dirección</span>}
            </p>
            <Asignados local={l} />
          </div>
        )}
      />
    </div>
  );
}
