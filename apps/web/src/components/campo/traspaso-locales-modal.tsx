"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/modal";
import { Paginacion } from "@/components/paginacion";
import { PantallaCarga } from "@/components/pantalla-carga";
import { SelectorPaginado } from "@/components/selector-paginado";
import { mostrarToast } from "@/components/toast/toast-controller";
import { useListaCampo, useOperacionCampo } from "@/hooks/use-lista-campo";
import { apiFetch } from "@/lib/api";
import { fechaEnZonaIso } from "@/utils/fechas";
import type {
  ClientePdv,
  PedidoTraspasoLocales,
  ResultadoTraspasoLocales,
  SeleccionLocales,
} from "@/types/campo";

// Pasar locales de un colaborador a otro, o intercambiarlos, desde una fecha.
// Los locales arrancan todos marcados: se guardan solo los que se desmarcan,
// así "todos" no obliga a descargar cientos de locales.

type Persona = { id: number; nombre: string };
type Marcas = { todos: boolean; ids: Set<string> };

const LIMITE = 500;
const TODOS: Marcas = { todos: true, ids: new Set() };
const marcado = (m: Marcas, id: string) =>
  m.todos ? !m.ids.has(id) : m.ids.has(id);
const cantidad = (m: Marcas, total: number) =>
  m.todos ? total - m.ids.size : m.ids.size;
const aSeleccion = (m: Marcas): SeleccionLocales =>
  m.todos
    ? { todos: true, excluir: [...m.ids], locales: [] }
    : { locales: [...m.ids], excluir: [] };
function alternar(m: Marcas, id: string): Marcas {
  const ids = new Set(m.ids);
  if (ids.has(id)) ids.delete(id);
  else ids.add(id);
  return { todos: m.todos, ids };
}
const plural = (n: number) => (n === 1 ? "1 local" : `${n} locales`);
const boton =
  "min-h-11 cursor-pointer whitespace-nowrap rounded-lg px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50";
const botonSecundario = `${boton} border border-line bg-surface-raised text-foreground hover:bg-surface-soft`;
const botonPrincipal = `${boton} bg-brand-700 text-white hover:bg-brand-800 dark:bg-brand-500 dark:text-zinc-950 dark:hover:bg-brand-400`;

function LocalesMarcables({
  persona,
  marcas,
  onCambiar,
  onTotal,
}: {
  persona: Persona;
  marcas: Marcas;
  onCambiar: (marcas: Marcas) => void;
  onTotal: (total: number) => void;
}) {
  const lista = useListaCampo<ClientePdv>(
    `/campo/locales?usuarioId=${persona.id}`,
    0,
    7,
  );
  const total = lista.datos?.total ?? 0;
  useEffect(() => {
    if (lista.datos) onTotal(lista.datos.total);
  }, [lista.datos, onTotal]);
  const todosMarcados = marcas.todos && marcas.ids.size === 0;
  return (
    <fieldset className="min-w-0 space-y-2 rounded-xl border border-line p-3">
      <legend className="px-1 text-sm font-bold text-foreground">
        Locales de {persona.nombre}
      </legend>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-muted">
          {cantidad(marcas, total)} de {total} marcados
        </p>
        {total > 0 && (
          <button
            type="button"
            onClick={() =>
              onCambiar({ todos: !todosMarcados, ids: new Set() })
            }
            className="min-h-11 cursor-pointer whitespace-nowrap rounded-lg px-2 text-sm font-semibold text-brand-700 hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus dark:text-brand-300"
          >
            {todosMarcados ? "Desmarcar todos" : "Marcar todos"}
          </button>
        )}
      </div>
      {lista.error ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {lista.error}
        </p>
      ) : lista.cargando && !lista.items.length ? (
        <p className="py-4 text-center text-xs text-muted">Cargando locales…</p>
      ) : !lista.items.length ? (
        <p className="py-4 text-center text-sm text-muted">
          No atiende locales hoy.
        </p>
      ) : (
        <ul className="divide-y divide-line" aria-label={`Locales de ${persona.nombre}`}>
          {lista.items.map((local) => (
            <li key={local.id}>
              <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg px-1 py-2 hover:bg-surface-soft">
                <input
                  type="checkbox"
                  checked={marcado(marcas, local.id)}
                  onChange={() => onCambiar(alternar(marcas, local.id))}
                  className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-brand-700 dark:accent-brand-500"
                />
                <span className="min-w-0">
                  <span className="line-clamp-2 block text-sm font-semibold text-foreground">
                    {local.nombre}
                  </span>
                  <span className="block truncate font-mono text-[11px] text-muted">
                    {local.id}
                    {local.direccion ? ` · ${local.direccion}` : ""}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {total > 0 && (
        <Paginacion
          page={lista.page}
          totalPages={lista.datos?.totalPages ?? 1}
          total={total}
          limit={lista.limit}
          onPageChange={lista.setPage}
          onLimitChange={lista.setLimit}
        />
      )}
    </fieldset>
  );
}

export function TraspasoLocalesModal({
  origenInicial,
  onCerrar,
  onHecho,
}: {
  origenInicial?: Persona;
  onCerrar: () => void;
  /** Se guardó: la pantalla recarga sus listas y cierra el modal. */
  onHecho: () => void;
}) {
  const hoy = fechaEnZonaIso(new Date());
  const [modo, setModo] = useState<"pasar" | "intercambiar">("pasar");
  const [origen, setOrigen] = useState<Persona | null>(origenInicial ?? null);
  const [destino, setDestino] = useState<Persona | null>(null);
  const [fecha, setFecha] = useState(() =>
    fechaEnZonaIso(new Date(Date.now() + 86_400_000)),
  );
  const [marcasA, setMarcasA] = useState<Marcas>(TODOS);
  const [marcasB, setMarcasB] = useState<Marcas>(TODOS);
  const [totalA, setTotalA] = useState(0);
  const [totalB, setTotalB] = useState(0);
  const [revisando, setRevisando] = useState(false);
  const op = useOperacionCampo();

  const intercambiar = modo === "intercambiar";
  const nA = origen ? cantidad(marcasA, totalA) : 0;
  const nB = intercambiar && destino ? cantidad(marcasB, totalB) : 0;
  const falta = !origen
    ? "Elegí de quién salen los locales."
    : !destino
      ? "Elegí a quién pasan."
      : fecha < hoy
        ? "La fecha no puede ser anterior a hoy."
        : nA === 0
          ? `Marcá al menos un local de ${origen.nombre}.`
          : intercambiar && nB === 0
            ? `Marcá al menos un local de ${destino.nombre} para intercambiar.`
            : nA > LIMITE || nB > LIMITE
              ? `Se pueden pasar hasta ${LIMITE} locales por vez.`
              : null;
  const fechaTexto = new Date(`${fecha}T12:00:00`).toLocaleDateString("es-PY", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  async function confirmar() {
    if (!origen || !destino) return;
    const pedido: PedidoTraspasoLocales = {
      origenId: origen.id,
      destinoId: destino.id,
      fecha,
      seleccion: aSeleccion(marcasA),
      ...(intercambiar ? { intercambio: aSeleccion(marcasB) } : {}),
    };
    const salida: { r?: ResultadoTraspasoLocales } = {};
    const ok = await op.ejecutar(
      intercambiar ? "Intercambiando locales" : "Pasando locales",
      async () => {
        salida.r = await apiFetch<ResultadoTraspasoLocales>(
          "/campo/asignaciones/traspaso",
          { method: "POST", body: JSON.stringify(pedido) },
        );
      },
    );
    setRevisando(false);
    if (!ok || !salida.r) return;
    const r = salida.r;
    const texto = `${plural(r.pasados)} de ${origen.nombre} a ${destino.nombre}${
      intercambiar
        ? ` y ${plural(r.intercambiados)} de ${destino.nombre} a ${origen.nombre}`
        : ""
    }, desde el ${fechaTexto}.`;
    if (r.omitidos.length)
      mostrarToast(
        "alerta",
        `${texto} ${plural(r.omitidos.length)} ya los atendía el otro: solo se cerró la asignación anterior.`,
        "Traspaso con avisos",
      );
    else
      mostrarToast(
        "exito",
        texto,
        intercambiar ? "Locales intercambiados" : "Locales pasados",
      );
    onHecho();
  }

  return (
    <>
      <Modal
        titulo="Pasar o intercambiar locales"
        abierto
        onCerrar={onCerrar}
        ancho="xl"
        pie={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
            {falta && (
              <p className="text-xs font-semibold text-amber-800 sm:mr-auto dark:text-amber-300">
                {falta}
              </p>
            )}
            <button type="button" onClick={onCerrar} className={botonSecundario}>
              Cancelar
            </button>
            <button
              type="button"
              disabled={!!falta}
              onClick={() => setRevisando(true)}
              className={botonPrincipal}
            >
              Revisar
            </button>
          </div>
        }
      >
        <div className="min-w-0 space-y-4">
          <div
            role="radiogroup"
            aria-label="Qué hacer"
            className="grid grid-cols-2 gap-1 rounded-xl bg-surface-soft p-1"
          >
            {(
              [
                ["pasar", "Pasar locales"],
                ["intercambiar", "Intercambiar"],
              ] as const
            ).map(([valor, texto]) => (
              <button
                key={valor}
                type="button"
                role="radio"
                aria-checked={modo === valor}
                onClick={() => setModo(valor)}
                className={`min-h-11 cursor-pointer whitespace-nowrap rounded-lg px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                  modo === valor
                    ? "bg-surface-raised text-foreground shadow-xs"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {texto}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <SelectorPaginado
              url="/campo/locales/colaboradores"
              etiqueta={intercambiar ? "Colaborador A" : "De"}
              buscable
              value={origen?.id ?? ""}
              seleccionActual={origen?.nombre}
              excluirId={destino?.id}
              onChange={(id) => {
                if (id === "") setOrigen(null);
                setMarcasA(TODOS);
              }}
              onSeleccionar={(opcion) =>
                setOrigen({ id: opcion.id, nombre: opcion.nombre ?? `#${opcion.id}` })
              }
            />
            <SelectorPaginado
              url="/campo/locales/colaboradores"
              etiqueta={intercambiar ? "Colaborador B" : "A"}
              buscable
              value={destino?.id ?? ""}
              seleccionActual={destino?.nombre}
              excluirId={origen?.id}
              onChange={(id) => {
                if (id === "") setDestino(null);
                setMarcasB(TODOS);
              }}
              onSeleccionar={(opcion) =>
                setDestino({ id: opcion.id, nombre: opcion.nombre ?? `#${opcion.id}` })
              }
            />
          </div>

          <div className="max-w-xs">
            <label
              htmlFor="traspaso-fecha"
              className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted"
            >
              A partir de
            </label>
            <input
              id="traspaso-fecha"
              type="date"
              min={hoy}
              required
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="min-h-11 w-full rounded-lg border border-line bg-surface-raised p-2.5 font-mono text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-focus"
            />
            <p className="mt-1 text-xs text-muted">
              Hasta el día anterior, cada uno sigue con sus locales.
            </p>
          </div>

          <div
            className={`grid grid-cols-1 gap-3 ${intercambiar ? "lg:grid-cols-2" : ""}`}
          >
            {origen && (
              <LocalesMarcables
                key={origen.id}
                persona={origen}
                marcas={marcasA}
                onCambiar={setMarcasA}
                onTotal={setTotalA}
              />
            )}
            {intercambiar && destino && (
              <LocalesMarcables
                key={destino.id}
                persona={destino}
                marcas={marcasB}
                onCambiar={setMarcasB}
                onTotal={setTotalB}
              />
            )}
          </div>

          {op.error && (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-950/60 dark:text-red-200"
            >
              {op.error}
            </p>
          )}
        </div>
      </Modal>

      {origen && destino && (
        <Modal
          titulo={intercambiar ? "Confirmar intercambio" : "Confirmar traspaso"}
          abierto={revisando}
          onCerrar={() => setRevisando(false)}
          pie={
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setRevisando(false)}
                className={botonSecundario}
              >
                Volver
              </button>
              <button
                type="button"
                disabled={!!op.mensaje}
                onClick={() => void confirmar()}
                className={botonPrincipal}
              >
                Confirmar
              </button>
            </div>
          }
        >
          <div className="space-y-3 text-sm text-foreground">
            <ul className="space-y-1.5">
              <li>
                <strong>{plural(nA)}</strong> de {origen.nombre} pasan a{" "}
                <strong>{destino.nombre}</strong>.
              </li>
              {intercambiar && (
                <li>
                  <strong>{plural(nB)}</strong> de {destino.nombre} pasan a{" "}
                  <strong>{origen.nombre}</strong>.
                </li>
              )}
            </ul>
            <p>
              Rige desde el <strong>{fechaTexto}</strong>. Hasta el día
              anterior nada cambia.
            </p>
            <p className="text-muted">
              Las visitas ya hechas quedan en el historial de quien las hizo y
              las franjas propias se copian al nuevo titular.
            </p>
          </div>
        </Modal>
      )}
      <PantallaCarga visible={!!op.mensaje} mensaje={op.mensaje || "Procesando"} />
    </>
  );
}
