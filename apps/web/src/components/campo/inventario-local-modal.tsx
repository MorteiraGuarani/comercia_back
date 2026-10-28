"use client";

import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Modal } from "@/components/modal";
import { IconoPaqueteMas } from "./ui/iconos-campo";
import { Paginacion } from "@/components/paginacion";
import { PantallaCarga } from "@/components/pantalla-carga";
import { usePanel } from "@/components/panel/contexto";
import { mostrarToast } from "@/components/toast/toast-controller";
import { useListaCampo, useOperacionCampo } from "@/hooks/use-lista-campo";
import { useEnLinea } from "@/hooks/use-en-linea";
import {
  descargarCopia,
  enviarPendientes,
  guardarCambios,
  leerCopia,
  leerLocal,
  listarPendientes,
  productosDeInventario,
} from "@/lib/inventario-db";
import { diasParaVencer, hoyEquipo, prepararCargasInventario } from "@/utils/inventario";
import { mensajeError } from "@/utils/error";
import { SelectorProductoInventario } from "./selector-producto-inventario";
import { PendientesInventario } from "./pendientes-inventario";
import type {
  CambioInventario,
  EdicionInventario,
  InventarioLocal,
  ItemInventarioLocal,
} from "@/types/inventario";

const fechaCorta = (iso: string) => {
  const [anio, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${anio}`;
};

const campo =
  "min-h-11 w-full min-w-0 rounded-lg border border-line bg-surface px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-brand-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-line dark:bg-surface dark:text-foreground";

// Cantidad y vencimiento chicos: entran más productos en la pantalla.
const campoCompacto =
  "h-9 w-full min-w-0 rounded-md border border-line bg-surface px-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:border-line dark:bg-surface dark:text-foreground";

const marco = "overflow-hidden rounded-2xl border border-line bg-surface-raised";

const btnMarca =
  "min-h-11 cursor-pointer whitespace-nowrap rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-brand-500 dark:text-zinc-950 dark:hover:bg-brand-400";

/** Estado del producto según su carga y los días de aviso de la empresa. */
function Estado({
  item,
  editable,
  diasAviso,
}: {
  item: ItemInventarioLocal;
  editable: boolean;
  diasAviso: number;
}) {
  const [texto, clase] =
    item.diasParaVencer === null
      ? editable
        ? ["Carga hoy", "bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-200"]
        : ["Sin carga", "bg-surface-soft text-muted"]
      : item.diasParaVencer < 0
        ? ["Vencido", "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200"]
        : item.diasParaVencer <= diasAviso
          ? [
              item.diasParaVencer === 0
                ? "Vence hoy"
                : `Vence en ${item.diasParaVencer} ${item.diasParaVencer === 1 ? "día" : "días"}`,
              "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
            ]
          : ["Cargado", "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"];
  return (
    <span className={`whitespace-nowrap rounded px-1.5 py-px text-[11px] font-semibold ${clase}`}>
      {texto}
    </span>
  );
}

function Cabecera({
  item,
  editable,
  diasAviso,
  onQuitar,
}: {
  item: ItemInventarioLocal;
  editable: boolean;
  diasAviso: number;
  onQuitar?: () => void;
}) {
  return (
    <div className="flex min-w-0 items-start gap-2">
      <p className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-0.5">
        <span className="min-w-0 break-words text-sm font-semibold leading-snug text-foreground">
          {item.itemname}
        </span>
        <span className="rounded bg-surface-soft px-1.5 py-px font-mono text-[11px] text-muted">
          {item.itemcode}
        </span>
        <Estado item={item} editable={editable} diasAviso={diasAviso} />
      </p>
      {onQuitar ? (
        <button
          type="button"
          aria-label={`Quitar ${item.itemname} del local`}
          title="Quitar del local"
          onClick={onQuitar}
          className="-my-1 grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-lg text-muted hover:bg-surface-soft hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

/** Lo cargado un día anterior: se consulta al servidor, necesita conexión. */
function Historial({
  localId,
  fecha,
  diasAviso,
}: {
  localId: string;
  fecha: string;
  diasAviso: number;
}) {
  const lista = useListaCampo<ItemInventarioLocal>(
    `/campo/inventario/locales/${encodeURIComponent(localId)}?fecha=${fecha}`,
    0,
    7,
  );
  const datos = lista.datos as InventarioLocal | null;
  return (
    <div className={marco}>
      {lista.error ? (
        <p role="alert" className="p-6 text-center text-sm text-red-700 dark:text-red-300">
          {lista.error}
        </p>
      ) : !datos ? (
        <p className="p-6 text-center text-sm text-muted">Cargando…</p>
      ) : lista.items.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted">No hay cargas en esta fecha.</p>
      ) : (
        <ul className="divide-y divide-line" aria-label="Productos cargados">
          {lista.items.map((item) => (
            <li key={item.itemcode} className="min-w-0 space-y-1 px-3 py-2">
              <Cabecera item={item} editable={false} diasAviso={diasAviso} />
              <p className="text-sm text-foreground">
                Cantidad: <strong>{item.cantidad ?? "—"}</strong>
                {item.vencimiento ? (
                  <>
                    {" "}· Vence: <strong>{fechaCorta(item.vencimiento)}</strong>
                  </>
                ) : null}
              </p>
            </li>
          ))}
        </ul>
      )}
      {datos && datos.totalPages > 1 ? (
        <div className="border-t border-line px-3">
          <Paginacion
            page={lista.page}
            totalPages={datos.totalPages}
            total={datos.total}
            limit={lista.limit}
            onPageChange={lista.setPage}
            onLimitChange={lista.setLimit}
          />
        </div>
      ) : null}
    </div>
  );
}

/**
 * Inventario de un local guardado en el equipo: hoy se carga aunque no haya
 * señal y los cambios se envían solos al volver la conexión. Las fechas
 * anteriores son de consulta y necesitan conexión.
 */
export function InventarioLocalModal({
  localId,
  textoCerrar = "Cerrar",
  onCerrar,
}: {
  localId: string;
  textoCerrar?: string;
  onCerrar: () => void;
}) {
  const { usuario } = usePanel();
  const usuarioId = usuario.id;
  const enLinea = useEnLinea();
  const [hoy] = useState(() => hoyEquipo());
  const local = useLiveQuery(
    () => leerLocal(usuarioId, localId).catch(() => null),
    [usuarioId, localId],
  );
  const copia = useLiveQuery(() => leerCopia(usuarioId).catch(() => null), [usuarioId]);
  // Productos con QryInventario = 'Y', guardados en el equipo: se precargan en
  // todos los locales (también sin señal).
  const fijos = useLiveQuery(
    () => productosDeInventario(usuarioId).catch(() => []),
    [usuarioId],
  );
  const diasAviso = copia?.diasAviso ?? 5;
  const op = useOperacionCampo();
  const [fecha, setFecha] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(7);
  // Cambios sin guardar por producto; sobreviven al cambiar de página.
  const [ediciones, setEdiciones] = useState<Record<string, EdicionInventario>>({});
  const [agregando, setAgregando] = useState(false);
  // Producto recién agregado: cuando aparece en la lista, va el foco a su cantidad.
  const enfocar = useRef<string | null>(null);
  const sinGuardar = Object.keys(ediciones).length > 0;
  const editable = !fecha && !!local;

  const fijosCodigos = new Set((fijos ?? []).map((p) => p.itemcode));
  const guardados = new Map((local?.items ?? []).map((i) => [i.itemcode, i]));
  // Primero los precargados (por nombre), después los agregados en su orden.
  const fuente = local
    ? [
        ...(fijos ?? []).map(
          (p) =>
            guardados.get(p.itemcode) ?? {
              itemcode: p.itemcode,
              itemname: p.itemname,
              cantidad: null,
              vencimiento: null,
              fecha: null,
            },
        ),
        ...local.items.filter((i) => !fijosCodigos.has(i.itemcode)),
      ]
    : [];
  // Cantidad y vencimiento guardados valen solo para el día en que se cargaron.
  const items: ItemInventarioLocal[] = fuente.map((i) => {
    const deHoy = i.fecha === hoy && i.vencimiento !== null;
    return {
      itemcode: i.itemcode,
      itemname: i.itemname,
      cantidad: deHoy ? i.cantidad : null,
      vencimiento: deHoy ? i.vencimiento : null,
      diasParaVencer: deHoy && i.vencimiento ? diasParaVencer(i.vencimiento, hoy) : null,
    };
  });
  const totalPages = Math.max(1, Math.ceil(items.length / limit));
  const pagina = Math.min(page, totalPages);
  const visibles = items.slice((pagina - 1) * limit, pagina * limit);
  const cargadosHoy = items.filter((i) => i.cantidad !== null).length;
  const codigos = new Set(items.map((i) => i.itemcode));

  const focoInicial = useRef(false);
  const primero = !fecha && fijos !== undefined ? visibles[0]?.itemcode : undefined;
  useEffect(() => {
    if (focoInicial.current || !primero) return;
    focoInicial.current = true;
    document.getElementById(`cantidad-${primero}`)?.focus();
  }, [primero]);

  useEffect(() => {
    const itemcode = enfocar.current;
    const entrada = itemcode ? document.getElementById(`cantidad-${itemcode}`) : null;
    if (!entrada) return;
    enfocar.current = null;
    entrada.focus();
    entrada.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [local, pagina]);

  const valor = (item: ItemInventarioLocal): EdicionInventario =>
    ediciones[item.itemcode] ?? {
      cantidad: item.cantidad === null ? "" : String(item.cantidad),
      vencimiento: item.vencimiento ?? "",
    };

  function editar(item: ItemInventarioLocal, cambio: Partial<EdicionInventario>) {
    setEdiciones((actual) => ({
      ...actual,
      [item.itemcode]: { ...valor(item), ...cambio },
    }));
  }

  async function guardarEnEquipo(cambios: CambioInventario[]) {
    try {
      await guardarCambios(usuarioId, localId, cambios);
      return true;
    } catch (e) {
      mostrarToast("error", mensajeError(e, "No se pudo guardar en este equipo"));
      return false;
    }
  }

  async function guardar() {
    const { cargas, pendientes } = prepararCargasInventario(ediciones);
    if (!cargas.length) {
      mostrarToast(
        "alerta",
        "Completá al menos un producto con cantidad entera entre 0 y 1.000.000 y un vencimiento válido.",
      );
      return;
    }
    // El servidor recibe hasta 50 productos por envío.
    const cambios: CambioInventario[] = [];
    for (let i = 0; i < cargas.length; i += 50)
      cambios.push({ tipo: "cargas", fecha: hoy, cargas: cargas.slice(i, i + 50) });
    const nuevos: CambioInventario[] = cargas
      .filter(({ itemcode }) => !guardados.has(itemcode))
      .map(({ itemcode }) => ({
        tipo: "agregar",
        itemcode,
        itemname: items.find((i) => i.itemcode === itemcode)?.itemname ?? itemcode,
      }));
    let completo = false;
    await op.ejecutar("Guardando inventario", async () => {
      await guardarCambios(usuarioId, localId, [...nuevos, ...cambios]);
      setEdiciones(pendientes);
      if (navigator.onLine) await enviarPendientes(usuarioId);
      const delLocal = (await listarPendientes(usuarioId).catch(() => [])).filter(
        (p) => p.localId === localId,
      );
      const rechazado = delLocal.find((p) => p.estado === "REVISAR");
      if (rechazado) {
        mostrarToast(
          "error",
          `${rechazado.error ?? "El servidor rechazó el cambio"}. Revisalo en los cambios pendientes del local.`,
          "No se guardó el inventario",
        );
        return;
      }
      const quedan = delLocal.length > 0;
      const faltan = Object.keys(pendientes).length;
      mostrarToast(
        quedan || faltan ? "alerta" : "exito",
        `${cargas.length} ${cargas.length === 1 ? "producto guardado" : "productos guardados"}.` +
          (quedan ? " Guardado en este equipo. Se envía solo cuando vuelva la conexión." : "") +
          (faltan ? ` ${faltan} ${faltan === 1 ? "producto pendiente" : "productos pendientes"}: completá o revisá su cantidad y vencimiento.` : ""),
      );
      completo = !faltan;
    });
    if (completo) onCerrar();
  }

  // Agregar o quitar es inmediato en el equipo; el envío sigue en segundo plano.
  async function cambiarProductos(cambio: CambioInventario) {
    if (await guardarEnEquipo([cambio]))
      void enviarPendientes(usuarioId).catch(() => undefined);
  }

  function cerrar() {
    if (
      sinGuardar &&
      !window.confirm("Hay cantidades o vencimientos sin guardar. ¿Salir igual?")
    )
      return;
    onCerrar();
  }

  return (
    <>
      <Modal titulo="Inventario" abierto onCerrar={cerrar} ancho="lg" hojaMovil>
        <div className="min-w-0 space-y-4">
          {/* El nombre del local, completo y legible: sin margen negativo que lo corte. */}
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl border border-line bg-surface-soft px-3 py-2">
            <p className="min-w-0 break-words text-sm font-semibold leading-snug text-foreground">
              {local?.nombre ??
                (local === undefined ? "Cargando…" : "Local sin datos en este equipo")}
            </p>
            {local ? (
              <span className="whitespace-nowrap rounded-full bg-surface-raised px-2 py-0.5 text-xs font-semibold text-muted">
                Hoy {cargadosHoy} de {items.length} cargados
              </span>
            ) : null}
          </div>

          <PendientesInventario usuarioId={usuarioId} localId={localId} />

          {local === null ? (
            <div className="space-y-3 rounded-xl border border-line bg-surface-soft p-4 text-sm text-foreground">
              <p>
                Este local todavía no está guardado en el equipo.
                {enLinea
                  ? " Descargá el inventario de tu ruta para cargarlo."
                  : " Conectate una vez para descargar el inventario de tu ruta."}
              </p>
              {enLinea ? (
                <button
                  type="button"
                  className={btnMarca}
                  onClick={() =>
                    void op.ejecutar("Descargando inventario", () => descargarCopia(usuarioId))
                  }
                >
                  Descargar inventario
                </button>
              ) : null}
            </div>
          ) : null}

          {local ? (
            <div className="flex min-w-0 flex-wrap items-end gap-3">
              <label className="min-w-0 flex-1 space-y-1.5">
                <span className="block text-xs font-bold uppercase tracking-wider text-muted">
                  Fecha de carga
                </span>
                <select
                  value={fecha}
                  disabled={sinGuardar || (!enLinea && !fecha)}
                  title={
                    !enLinea
                      ? "Las fechas anteriores se consultan con conexión"
                      : sinGuardar
                        ? "Guardá o descartá los cambios para cambiar de fecha"
                        : undefined
                  }
                  onChange={(e) => {
                    setFecha(e.target.value);
                    setAgregando(false);
                  }}
                  className={campo}
                >
                  <option value="">Hoy, {fechaCorta(hoy)}</option>
                  {local.fechas
                    .filter((f) => f < hoy)
                    .map((f) => (
                      <option key={f} value={f}>
                        {fechaCorta(f)}
                      </option>
                    ))}
                </select>
              </label>
              {editable ? (
                <button
                  type="button"
                  onClick={() => setAgregando((a) => !a)}
                  aria-expanded={agregando}
                  aria-label="Agregar productos"
                  className={`${btnMarca} inline-flex items-center gap-1.5`}
                >
                  <IconoPaqueteMas className="h-5 w-5 shrink-0" />
                  Agregar
                </button>
              ) : null}
            </div>
          ) : null}

          {agregando && editable ? (
            <div className="rounded-xl border border-line bg-surface-soft p-3">
              <SelectorProductoInventario
                usuarioId={usuarioId}
                elegidos={codigos}
                version={copia?.sincronizadoEn ?? 0}
                onElegir={(producto) => {
                  // Se agrega al final: se muestra la última página y se enfoca su cantidad.
                  enfocar.current = producto.itemcode;
                  setPage(Math.floor(items.length / limit) + 1);
                  void cambiarProductos({
                    tipo: "agregar",
                    itemcode: producto.itemcode,
                    itemname: producto.itemname,
                  });
                }}
              />
              <p className="mt-2 text-xs text-muted">
                El producto queda en el inventario de este local para las próximas cargas.
              </p>
            </div>
          ) : null}

          {op.error ? (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
            >
              {op.error}
            </p>
          ) : null}

          {fecha ? (
            <Historial localId={localId} fecha={fecha} diasAviso={diasAviso} />
          ) : local ? (
            <div className={marco}>
              {items.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted">
                  Todavía no hay productos en este local. Agregalos con «+ Agregar».
                </p>
              ) : (
                <ul className="divide-y divide-line" aria-label="Productos del local">
                  {visibles.map((item) => {
                    const v = valor(item);
                    return (
                      <li key={item.itemcode} className="min-w-0 space-y-1.5 px-3 py-2">
                        <Cabecera
                          item={item}
                          editable
                          diasAviso={diasAviso}
                          // Los precargados (QryInventario = 'Y') no se quitan del local.
                          onQuitar={
                            fijosCodigos.has(item.itemcode)
                              ? undefined
                              : () => {
                                  setEdiciones((actual) => {
                                    const resto = { ...actual };
                                    delete resto[item.itemcode];
                                    return resto;
                                  });
                                  void cambiarProductos({ tipo: "quitar", itemcode: item.itemcode });
                                }
                          }
                        />
                        <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2 sm:max-w-sm">
                          <input
                            id={`cantidad-${item.itemcode}`}
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={1_000_000}
                            step={1}
                            placeholder="Cant."
                            aria-label={`Cantidad de ${item.itemname}`}
                            value={v.cantidad}
                            onChange={(e) => editar(item, { cantidad: e.target.value })}
                            className={campoCompacto}
                          />
                          <input
                            type="date"
                            aria-label={`Vencimiento de ${item.itemname}`}
                            title="Vencimiento"
                            value={v.vencimiento}
                            onChange={(e) => editar(item, { vencimiento: e.target.value })}
                            className={campoCompacto}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              {totalPages > 1 ? (
                <div className="border-t border-line px-3">
                  <Paginacion
                    page={pagina}
                    totalPages={totalPages}
                    total={items.length}
                    limit={limit}
                    onPageChange={setPage}
                    onLimitChange={(l) => {
                      setLimit(l);
                      setPage(1);
                    }}
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          <p className="text-sm text-muted">
            {editable ? "Podés guardar una parte del inventario: solo se guardan los productos con cantidad y vencimiento completos. " : ""}
            {enLinea
              ? "Hoy se carga cantidad y fecha de vencimiento. Las fechas anteriores son de consulta."
              : "Sin conexión: lo que cargues queda guardado en este equipo y se envía solo cuando vuelva la señal."}
            {` Avisamos ${diasAviso} ${diasAviso === 1 ? "día" : "días"} antes de que venza.`}
          </p>

          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            {editable ? (
              <button
                type="button"
                onClick={() => void guardar()}
                disabled={!sinGuardar || !!op.mensaje}
                className={`${btnMarca} sm:flex-1`}
              >
                Guardar inventario
              </button>
            ) : null}
            <button
              type="button"
              onClick={cerrar}
              className="min-h-11 cursor-pointer whitespace-nowrap rounded-lg border border-line bg-surface-soft px-4 text-sm font-semibold text-foreground hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus sm:flex-1"
            >
              {textoCerrar}
            </button>
          </div>
        </div>
      </Modal>
      <PantallaCarga visible={!!op.mensaje} mensaje={op.mensaje ?? "Procesando"} />
    </>
  );
}
