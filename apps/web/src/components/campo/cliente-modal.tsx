"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { apiFetch } from "@/lib/api";
import { useOperacionCampo } from "@/hooks/use-lista-campo";
import { Modal } from "@/components/modal";
import { PantallaCarga } from "@/components/pantalla-carga";
import { mostrarToast } from "@/components/toast/toast-controller";
import { usePanel } from "@/components/panel/contexto";
import { HorariosLocal } from "./horarios-local";
import { AsignacionesLocal } from "./asignaciones-local";
import { calcularDvRucPy } from "@/utils/ruc";
import { formatearTelefono, pistaTelefono } from "@/utils/telefono";
import type { ClientePdv } from "@/types/campo";

const SelectorUbicacion = dynamic(() => import("./selector-ubicacion"), {
  ssr: false,
  loading: () => (
    <p className="py-4 text-center text-xs text-muted">Cargando mapa…</p>
  ),
});

// Solo orienta el mapa de un cliente sin ubicación: no se guarda.
const CENTRO_INICIAL = { latitud: -25.2969, longitud: -57.6415 };

export type PestanaCliente = "datos" | "horarios" | "personal";

const PESTANAS: { clave: PestanaCliente; texto: string }[] = [
  { clave: "datos", texto: "Datos y ubicación" },
  { clave: "horarios", texto: "Horarios" },
  { clave: "personal", texto: "Personal asignado" },
];

const campoClase =
  "min-h-11 w-full min-w-0 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-brand-600 read-only:bg-surface-soft read-only:text-muted dark:border-line dark:bg-surface dark:text-foreground";

/**
 * Alta y edición del cliente (OCRD + dirección CRD1) con su punto en el mapa.
 * Guardado el cliente, se cargan sus horarios y el personal (uno o varios).
 */
export function ClienteModal({
  cliente: inicial,
  pestana = "datos",
  onCerrar,
  onGuardado,
}: {
  cliente?: ClientePdv;
  pestana?: PestanaCliente;
  onCerrar: () => void;
  onGuardado: (cliente: ClientePdv) => void;
}) {
  const op = useOperacionCampo();
  const { usuario } = usePanel();
  const [cliente, setCliente] = useState(inicial);
  const [vista, setVista] = useState<PestanaCliente>(
    inicial ? pestana : "datos",
  );
  const [form, setForm] = useState({
    CardCode: inicial?.id ?? "",
    CardName: inicial?.nombre ?? "",
    // Solo el número base: el dígito verificador se calcula solo.
    rucBase: (inicial?.ruc ?? "").split("-")[0].replace(/\D/g, "").slice(0, 8),
    Phone1: formatearTelefono(inicial?.telefono ?? ""),
    Address: inicial?.address ?? "",
    Street: inicial?.street ?? "",
  });
  // Sin punto marcado no se envía nada y se conserva la ubicación actual.
  const [punto, setPunto] = useState(
    inicial?.latitud != null && inicial.longitud != null
      ? { latitud: inicial.latitud, longitud: inicial.longitud }
      : null,
  );
  const dvRuc =
    form.rucBase.length >= 3 ? calcularDvRucPy(form.rucBase) : null;
  const telefono = pistaTelefono(form.Phone1);
  const cambiar =
    (campo: keyof typeof form) =>
    (evento: React.ChangeEvent<HTMLInputElement>) =>
      setForm((actual) => ({ ...actual, [campo]: evento.target.value }));

  async function guardar(evento: React.FormEvent) {
    evento.preventDefault();
    let guardado: ClientePdv | undefined;
    const ok = await op.ejecutar(
      cliente ? "Guardando cliente" : "Creando cliente",
      async () => {
        guardado = await apiFetch<ClientePdv>(
          cliente
            ? `/campo/locales/${encodeURIComponent(cliente.id)}`
            : "/campo/locales",
          {
            method: cliente ? "PUT" : "POST",
            body: JSON.stringify({
              ...(cliente ? {} : { CardCode: form.CardCode.trim() }),
              CardName: form.CardName.trim(),
              LicTradNum: dvRuc === null ? "" : `${form.rucBase}-${dvRuc}`,
              Phone1: telefono.e164,
              Address: form.Address.trim(),
              Street: form.Street.trim(),
              ...punto,
            }),
          },
        );
      },
    );
    if (!ok || !guardado) return;
    onGuardado(guardado);
    if (cliente) {
      mostrarToast("exito", `Cliente ${guardado.nombre} actualizado.`);
      return;
    }
    setCliente(guardado);
    setVista("horarios");
    mostrarToast(
      "exito",
      `Cliente ${guardado.nombre} creado. Ahora cargá sus horarios y el personal.`,
    );
  }

  return (
    <>
      <Modal
        titulo={cliente ? `Cliente · ${cliente.nombre}` : "Crear cliente"}
        abierto
        ancho="xl"
        onCerrar={() => {
          if (!op.mensaje) onCerrar();
        }}
      >
        <div className="campo-screen min-w-0 w-full space-y-4">
          <div
            role="tablist"
            aria-label="Secciones del cliente"
            className="flex min-w-0 flex-wrap gap-2 border-b border-line pb-3"
          >
            {PESTANAS.map(({ clave, texto }) => {
              const bloqueada = clave !== "datos" && !cliente;
              return (
                <button
                  key={clave}
                  type="button"
                  role="tab"
                  aria-selected={vista === clave}
                  disabled={bloqueada}
                  title={bloqueada ? "Primero creá el cliente" : undefined}
                  onClick={() => setVista(clave)}
                  className={`min-h-11 min-w-0 flex-1 cursor-pointer whitespace-nowrap rounded-lg px-3 text-xs font-bold uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none sm:px-4 ${
                    vista === clave
                      ? "bg-foreground text-background"
                      : "border border-line bg-surface-raised text-muted hover:bg-surface-soft hover:text-foreground"
                  }`}
                >
                  {texto}
                </button>
              );
            })}
          </div>

          {vista === "datos" ? (
            <form className="space-y-4" onSubmit={guardar}>
              {op.error && (
                <p
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
                >
                  {op.error}
                </p>
              )}
              <fieldset
                disabled={!!op.mensaje}
                className="min-w-0 space-y-4"
              >
                <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="min-w-0 space-y-1.5 text-sm font-semibold">
                    <span>Código de cliente</span>
                    <input
                      type="text"
                      name="CardCode"
                      required
                      readOnly={!!cliente}
                      maxLength={50}
                      pattern=".*\S.*"
                      title={
                        cliente
                          ? "El código no se puede cambiar"
                          : "Ingresá un código de hasta 50 caracteres"
                      }
                      value={form.CardCode}
                      onChange={cambiar("CardCode")}
                      className={campoClase}
                    />
                  </label>
                  <label className="min-w-0 space-y-1.5 text-sm font-semibold">
                    <span>Nombre de cliente</span>
                    <input
                      type="text"
                      name="CardName"
                      required
                      maxLength={250}
                      pattern=".*\S.*"
                      title="Ingresá el nombre del cliente"
                      value={form.CardName}
                      onChange={cambiar("CardName")}
                      className={campoClase}
                    />
                  </label>
                </div>
                <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="min-w-0 space-y-1.5 text-sm font-semibold">
                    <span>RUC (opcional)</span>
                    <span className="flex min-w-0 items-center gap-2">
                      <input
                        type="text"
                        name="LicTradNum"
                        inputMode="numeric"
                        maxLength={8}
                        placeholder="Ej.: 80012345"
                        aria-describedby="ruc-dv"
                        value={form.rucBase}
                        onChange={(evento) =>
                          setForm((actual) => ({
                            ...actual,
                            // Si pegan "80012345-0", el DV se recalcula.
                            rucBase: evento.target.value
                              .split("-")[0]
                              .replace(/\D/g, "")
                              .slice(0, 8),
                          }))
                        }
                        className={campoClase}
                      />
                      <output
                        id="ruc-dv"
                        aria-label="Dígito verificador"
                        title="Dígito verificador calculado"
                        className="grid min-h-11 w-14 shrink-0 place-items-center rounded-lg border border-line bg-surface-soft font-mono text-sm text-foreground"
                      >
                        -{dvRuc ?? "?"}
                      </output>
                    </span>
                  </label>
                  <label className="min-w-0 space-y-1.5 text-sm font-semibold">
                    <span>Teléfono (opcional)</span>
                    <input
                      type="tel"
                      name="Phone1"
                      autoComplete="tel"
                      placeholder="+595 991 188620"
                      maxLength={30}
                      aria-invalid={!telefono.valido || undefined}
                      aria-describedby="telefono-pista"
                      value={form.Phone1}
                      onChange={(evento) => {
                        const valor = evento.target.value;
                        const digitos = (texto: string) =>
                          texto.replace(/\D/g, "").length;
                        // Formatea si suma dígitos; al borrar deja el texto tal cual.
                        setForm((actual) => ({
                          ...actual,
                          Phone1:
                            digitos(valor) > digitos(actual.Phone1)
                              ? formatearTelefono(valor)
                              : valor,
                        }));
                      }}
                      onBlur={() =>
                        setForm((actual) => ({
                          ...actual,
                          Phone1: formatearTelefono(actual.Phone1),
                        }))
                      }
                      className={campoClase}
                    />
                    <span
                      id="telefono-pista"
                      className={`block text-xs font-normal ${telefono.valido ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}`}
                    >
                      {telefono.mensaje}
                    </span>
                  </label>
                </div>
                <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="min-w-0 space-y-1.5 text-sm font-semibold">
                    <span>Dirección (opcional)</span>
                    <input
                      type="text"
                      name="Address"
                      maxLength={200}
                      placeholder="Ej.: Itauguá"
                      value={form.Address}
                      onChange={cambiar("Address")}
                      className={campoClase}
                    />
                  </label>
                  <label className="min-w-0 space-y-1.5 text-sm font-semibold">
                    <span>Calle (opcional)</span>
                    <input
                      type="text"
                      name="Street"
                      maxLength={200}
                      placeholder="Ej.: Gobernador Irala"
                      value={form.Street}
                      onChange={cambiar("Street")}
                      className={campoClase}
                    />
                  </label>
                </div>
                <div className="min-w-0 space-y-1.5">
                  <p className="text-sm font-semibold">Ubicación en el mapa</p>
                  <p className="text-xs text-muted">
                    {punto
                      ? `Marcado en ${punto.latitud.toFixed(5)}, ${punto.longitud.toFixed(5)}. Buscá otro lugar, tocá el mapa o arrastrá el pin para corregirlo.`
                      : "Todavía sin ubicación: buscá el lugar, tocá el mapa o usá tu GPS para marcar dónde está el cliente."}
                  </p>
                  <div className="overflow-hidden rounded-xl border border-line">
                    <SelectorUbicacion
                      latitud={punto?.latitud ?? CENTRO_INICIAL.latitud}
                      longitud={punto?.longitud ?? CENTRO_INICIAL.longitud}
                      onChange={(latitud, longitud) =>
                        setPunto({ latitud, longitud })
                      }
                    />
                  </div>
                </div>
              </fieldset>
              <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
                <button
                  type="button"
                  onClick={onCerrar}
                  disabled={!!op.mensaje}
                  className="min-h-11 cursor-pointer whitespace-nowrap rounded-lg border border-line px-4 text-sm font-semibold text-foreground hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={
                    !!op.mensaje ||
                    !form.CardCode.trim() ||
                    !form.CardName.trim() ||
                    !telefono.valido
                  }
                  className="min-h-11 cursor-pointer whitespace-nowrap rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-brand-500 dark:text-zinc-950 dark:hover:bg-brand-400"
                >
                  {cliente ? "Guardar cambios" : "Siguiente"}
                </button>
              </div>
            </form>
          ) : (
            cliente && (
              <div className="min-w-0 space-y-4">
                <p className="text-sm text-muted">
                  Equipo:{" "}
                  <strong className="text-foreground">
                    {usuario.rol?.equipoCampo?.nombre ?? "Sin equipo operativo"}
                  </strong>
                  . Los horarios y el personal se configuran para este equipo.
                </p>
                {vista === "horarios" ? (
                  <HorariosLocal localId={cliente.id} />
                ) : (
                  <AsignacionesLocal localId={cliente.id} />
                )}
                <div className="flex justify-end border-t border-line pt-4">
                  <button
                    type="button"
                    onClick={() =>
                      vista === "horarios" ? setVista("personal") : onCerrar()
                    }
                    className="min-h-11 cursor-pointer whitespace-nowrap rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:bg-brand-500 dark:text-zinc-950 dark:hover:bg-brand-400"
                  >
                    {vista === "horarios" ? "Siguiente" : "Listo"}
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      </Modal>
      <PantallaCarga visible={!!op.mensaje} mensaje={op.mensaje} />
    </>
  );
}
