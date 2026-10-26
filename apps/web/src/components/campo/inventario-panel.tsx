"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { btnGhost, btnPrimary, errorBox } from "@/components/ui";
import { PantallaCarga } from "@/components/pantalla-carga";
import { usePanel } from "@/components/panel/contexto";
import { mostrarToast } from "@/components/toast/toast-controller";
import { useOperacionCampo } from "@/hooks/use-lista-campo";
import { useEnLinea } from "@/hooks/use-en-linea";
import { leerCopia, listarLocales, sincronizarInventario } from "@/lib/inventario-db";
import { formatoFechaHora } from "@/utils/fechas";
import { mensajeError } from "@/utils/error";
import { TopBar } from "./ui/top-bar";
import { BuscadorCatalogo } from "./ui/filtros-catalogo";
import { TablaCampo } from "./tabla-campo";
import { InventarioLocalModal } from "./inventario-local-modal";
import { PendientesInventario } from "./pendientes-inventario";
import type { CopiaGuardada } from "@/types/inventario";

/**
 * Inventario de los locales de la ruta, guardado en el equipo para trabajar
 * sin señal. Desde Mi Ruta se llega con ?local=CardCode y se abre ese local;
 * con local principal o un solo local, se abre ese directamente.
 */
export function InventarioPanel() {
  const router = useRouter();
  const { usuario } = usePanel();
  const usuarioId = usuario.id;
  const enLinea = useEnLinea();
  const desdeRuta = useSearchParams().get("local");
  const [abierto, setAbierto] = useState<string | null>(desdeRuta);
  // Al cerrar el local que se abrió solo, no se vuelve a abrir.
  const [autoCerrado, setAutoCerrado] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(7);
  const op = useOperacionCampo();
  const lectura = useLiveQuery<{ copia: CopiaGuardada | null; error: string | null }>(
    () =>
      leerCopia(usuarioId).then(
        (copia) => ({ copia, error: null }),
        (e: unknown) => ({
          copia: null,
          error: mensajeError(e, "Este navegador no permite guardar datos sin conexión"),
        }),
      ),
    [usuarioId],
  );
  const locales = useLiveQuery(
    () => listarLocales(usuarioId, busqueda, page, limit).catch(() => null),
    [usuarioId, busqueda, page, limit],
  );
  const copia = lectura?.copia ?? null;
  // Con local principal en la ruta, o con un solo local, se entra directo a su inventario.
  const automatico =
    desdeRuta || autoCerrado || !copia
      ? null
      : (copia.localPrincipalId ??
        (!busqueda && locales?.total === 1 ? (locales.items[0]?.id ?? null) : null));
  const localAbierto = abierto ?? automatico;

  async function actualizar() {
    if (await op.ejecutar("Actualizando inventario", () => sincronizarInventario(usuarioId, true)))
      mostrarToast("exito", "Inventario actualizado en este equipo.");
  }

  return (
    <div className="min-w-0 w-full">
      <TopBar
        title="Inventario"
        subtitle="Cargá la cantidad y el vencimiento de los productos de cada local."
      />
      <div className="mx-auto w-full min-w-0 max-w-5xl space-y-4 px-4 py-5 sm:px-6 lg:px-8">
        {lectura?.error ? <p role="alert" className={errorBox}>{lectura.error}</p> : null}
        {op.error ? <p role="alert" className={errorBox}>{op.error}</p> : null}

        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface-raised p-3 text-sm">
          <p className="min-w-0 text-muted">
            {copia
              ? `Guardado en este equipo el ${formatoFechaHora(new Date(copia.sincronizadoEn).toISOString())} · ${copia.locales.toLocaleString("es-PY")} locales · ${copia.productos.toLocaleString("es-PY")} productos.`
              : lectura === undefined
                ? "Leyendo el inventario guardado…"
                : enLinea
                  ? "Descargando el inventario de tu ruta para usarlo sin señal…"
                  : "Conectate una vez para descargar el inventario de tu ruta y usarlo sin señal."}
            {copia && !enLinea
              ? " Sin conexión: los cambios se envían solos cuando vuelva la señal."
              : ""}
          </p>
          <button
            type="button"
            className={`${btnGhost} whitespace-nowrap`}
            disabled={!enLinea || !!op.mensaje}
            title={enLinea ? undefined : "Necesita conexión"}
            onClick={() => void actualizar()}
          >
            Actualizar ahora
          </button>
        </div>

        <PendientesInventario usuarioId={usuarioId} />

        {copia ? (
          <>
            <BuscadorCatalogo
              valor={busqueda}
              onCambio={(valor) => {
                setBusqueda(valor);
                setPage(1);
              }}
              placeholder="Buscar local…"
              etiqueta="Buscar local"
            />
            <TablaCampo
              lista={{
                datos: locales ?? null,
                items: locales?.items ?? [],
                cargando: false,
                error: null,
                setPage,
                setLimit: (l) => {
                  setLimit(l);
                  setPage(1);
                },
                refrescar: () => undefined,
              }}
              etiqueta="Locales de tu ruta"
              columnas={[
                {
                  titulo: "Local",
                  valor: (l) => (
                    <div className="min-w-0">
                      <p className="break-words font-semibold text-foreground">{l.nombre}</p>
                      <p className="break-words text-xs text-muted">{l.direccion || l.id}</p>
                    </div>
                  ),
                },
              ]}
              acciones={(l) => (
                <button
                  type="button"
                  className={`${btnPrimary} whitespace-nowrap`}
                  onClick={() => setAbierto(l.id)}
                >
                  Abrir inventario
                </button>
              )}
            />
          </>
        ) : null}
      </div>
      {localAbierto ? (
        <InventarioLocalModal
          key={localAbierto}
          localId={localAbierto}
          textoCerrar={desdeRuta === localAbierto ? "Volver a la visita" : "Cerrar"}
          onCerrar={() => {
            setAbierto(null);
            if (!abierto) setAutoCerrado(true);
            if (desdeRuta === localAbierto) router.back();
          }}
        />
      ) : null}
      <PantallaCarga visible={!!op.mensaje} mensaje={op.mensaje || "Procesando"} />
    </div>
  );
}
