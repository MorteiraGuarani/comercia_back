"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import { apiFetch } from "@/lib/api";
import { useListaCampo, useOperacionCampo } from "@/hooks/use-lista-campo";
import { Modal } from "@/components/modal";
import { PantallaCarga } from "@/components/pantalla-carga";
import { SelectorPaginado } from "@/components/selector-paginado";
import { btnGhost, errorBox } from "@/components/ui";
import { TablaCampo } from "./tabla-campo";
import {
  BotonesFormulario,
  CabeceraCampo,
  CampoActivo,
  CampoTexto,
} from "./form-campo";
import { MapaLocal } from "./mapa-local";
import { PlanLocal } from "./plan-local";
import type { ClienteCampo, LocalCampo } from "@/types/campo";

const SelectorUbicacion = dynamic(() => import("./selector-ubicacion"), {
  ssr: false,
  loading: () => <p role="status">Cargando mapa…</p>,
});

export function ClientesPanel() {
  const [busqueda, setBusqueda] = useState("");
  const lista = useListaCampo<ClienteCampo>(
    `/campo/clientes${busqueda.trim() ? `?buscar=${encodeURIComponent(busqueda.trim())}` : ""}`,
  );
  const op = useOperacionCampo();
  const [form, setForm] = useState<ClienteCampo | null>(null);
  return (
    <>
      <CabeceraCampo
        titulo="Clientes"
        detalle="Clientes de tu empresa y sus datos de contacto."
        crear={() =>
          setForm({
            id: 0,
            nombre: "",
            ruc: "",
            contacto: "",
            telefono: "",
            activo: true,
          })
        }
      />

      {/* Buscador y Resumen */}
      <div className="mb-4 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted">
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="2"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <input
            type="text"
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              lista.setPage(1);
            }}
            placeholder="Buscar cliente por nombre o RUC…"
            className="w-full rounded-xl border border-line bg-surface-raised py-2 pl-9 pr-8 text-sm text-foreground outline-none transition placeholder:text-muted focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30"
          />
          {busqueda && (
            <button
              type="button"
              onClick={() => setBusqueda("")}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted hover:text-foreground"
              title="Limpiar búsqueda"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth="2"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
        <div className="text-xs text-muted">
          <span>{lista.datos?.total ?? lista.items.length} clientes registrados</span>
        </div>
      </div>

      <TablaCampo
        lista={lista}
        etiqueta="Clientes"
        columnas={[
          {
            titulo: "Cliente",
            valor: (x) => (
              <div className="flex items-center gap-2.5">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line bg-surface-soft text-foreground">
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth="1.8"
                    aria-hidden="true"
                  >
                    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
                <span className="font-semibold text-foreground">{x.nombre}</span>
              </div>
            ),
          },
          { titulo: "RUC", valor: (x) => x.ruc || "—" },
          { titulo: "Contacto", valor: (x) => `${x.contacto} ${x.telefono ? `(${x.telefono})` : ""}` },
          {
            titulo: "Estado",
            valor: (x) => (
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                  x.activo
                    ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                    : "bg-zinc-100 text-zinc-600 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"
                }`}
              >
                {x.activo ? "Activo" : "Inactivo"}
              </span>
            ),
          },
        ]}
        tarjetaMovil={(x) => (
          <div className="rounded-xl border border-line bg-surface-raised p-4 shadow-[0_2px_8px_rgba(var(--warm-shadow),0.06)] transition-[border-color] hover:border-brand-500/40">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line bg-surface-soft text-foreground font-semibold">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth="1.8"
                  aria-hidden="true"
                >
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="truncate font-semibold text-base text-foreground">
                    {x.nombre}
                  </h4>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold border tracking-wider ${
                      x.activo
                        ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                        : "bg-zinc-100 text-zinc-600 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"
                    }`}
                  >
                    {x.activo ? "ACTIVO" : "INACTIVO"}
                  </span>
                </div>
                {x.ruc && (
                  <p className="mt-0.5 font-mono text-xs text-muted">
                    RUC: {x.ruc}
                  </p>
                )}
                {(x.contacto || x.telefono) && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted truncate">
                    <svg
                      className="h-3.5 w-3.5 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth="2"
                      aria-hidden="true"
                    >
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                    <span className="truncate">{x.contacto} {x.telefono ? `· ${x.telefono}` : ""}</span>
                  </p>
                )}
              </div>
            </div>
            <div className="mt-3.5 flex items-center justify-end border-t border-line/60 pt-2.5">
              <button
                type="button"
                className="min-h-11 rounded-lg border border-line bg-surface-soft px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-raised transition-colors flex items-center justify-center gap-1.5"
                onClick={() => setForm(x)}
              >
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Editar
              </button>
            </div>
          </div>
        )}
        acciones={(x) => (
          <button className={btnGhost} onClick={() => setForm(x)}>
            Editar
          </button>
        )}
      />
      <Modal
        titulo={form?.id ? "Editar cliente" : "Crear cliente"}
        abierto={!!form}
        onCerrar={() => {
          if (!op.mensaje) setForm(null);
        }}
      >
        {form ? (
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const { id, ...data } = form;
              if (
                await op.ejecutar("Guardando cliente", () =>
                  apiFetch(`/campo/clientes${id ? `/${id}` : ""}`, {
                    method: id ? "PUT" : "POST",
                    body: JSON.stringify(data),
                  }),
                )
              ) {
                setForm(null);
                lista.refrescar();
              }
            }}
          >
            <CampoTexto
              titulo="Nombre"
              value={form.nombre}
              required
              onChange={(nombre) => setForm({ ...form, nombre })}
            />
            <CampoTexto
              titulo="RUC"
              value={form.ruc}
              maxLength={30}
              onChange={(ruc) => setForm({ ...form, ruc })}
            />
            <CampoTexto
              titulo="Contacto"
              value={form.contacto}
              onChange={(contacto) => setForm({ ...form, contacto })}
            />
            <CampoTexto
              titulo="Teléfono"
              value={form.telefono}
              maxLength={40}
              onChange={(telefono) => setForm({ ...form, telefono })}
            />
            <CampoActivo
              value={form.activo}
              onChange={(activo) => setForm({ ...form, activo })}
            />
            {op.error ? <p className={errorBox}>{op.error}</p> : null}
            <BotonesFormulario
              ocupado={!!op.mensaje}
              cancelar={() => setForm(null)}
            />
          </form>
        ) : null}
      </Modal>
      <PantallaCarga visible={!!op.mensaje} mensaje={op.mensaje} />
    </>
  );
}

export function LocalesPanel() {
  const [busqueda, setBusqueda] = useState("");
  const lista = useListaCampo<LocalCampo>(
    `/campo/locales${busqueda.trim() ? `?buscar=${encodeURIComponent(busqueda.trim())}` : ""}`,
  );
  const op = useOperacionCampo();
  const [form, setForm] = useState<LocalCampo | null>(null);
  const [plan, setPlan] = useState<LocalCampo | null>(null);
  const [mapa, setMapa] = useState<LocalCampo | null>(null);
  return (
    <>
      <CabeceraCampo
        titulo="Locales"
        detalle="Ubicación, franjas de atención y asignaciones de tu equipo."
        crear={() =>
          setForm({
            id: 0,
            clienteId: 0,
            cliente: { id: 0, nombre: "" },
            nombre: "",
            direccion: "",
            contacto: "",
            telefono: "",
            latitud: -25.3,
            longitud: -57.6,
            notas: "",
            activo: true,
          })
        }
      />

      {/* Buscador y Resumen estilo Clientes del mockup */}
      <div className="mb-4 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted">
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="2"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <input
            type="text"
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              lista.setPage(1);
            }}
            placeholder="Buscar local por nombre o cliente…"
            className="w-full rounded-xl border border-line bg-surface-raised py-2 pl-9 pr-8 text-sm text-foreground outline-none transition placeholder:text-muted focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30"
          />
          {busqueda && (
            <button
              type="button"
              onClick={() => setBusqueda("")}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted hover:text-foreground"
              title="Limpiar búsqueda"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth="2"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
        <div className="text-xs text-muted">
          <span>{lista.datos?.total ?? lista.items.length} locales registrados</span>
        </div>
      </div>

      <TablaCampo
        lista={lista}
        etiqueta="Locales"
        columnas={[
          {
            titulo: "Local",
            valor: (x) => (
              <div className="flex items-center gap-2.5">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line bg-surface-soft text-foreground">
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth="1.8"
                    aria-hidden="true"
                  >
                    <path d="M4 10 5 4h14l1 6" />
                    <rect x="4" y="10" width="16" height="10" rx="1" />
                    <line x1="9" y1="20" x2="9" y2="14" />
                    <line x1="15" y1="14" x2="15" y2="20" />
                  </svg>
                </div>
                <div>
                  <strong className="block font-semibold text-foreground">{x.nombre}</strong>
                  {x.notas ? <p className="text-xs text-muted truncate max-w-xs">{x.notas}</p> : null}
                </div>
              </div>
            ),
          },
          {
            titulo: "Cliente",
            valor: (x) => (
              <span className="inline-flex items-center rounded-full bg-surface-soft px-2.5 py-0.5 text-xs font-medium text-foreground">
                {x.cliente.nombre}
              </span>
            ),
          },
          {
            titulo: "Dirección",
            valor: (x) => (
              <span className="text-xs text-muted">
                {x.direccion || "Sin dirección"}
              </span>
            ),
          },
          {
            titulo: "Estado",
            valor: (x) => (
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                  x.activo
                    ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                    : "bg-zinc-100 text-zinc-600 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"
                }`}
              >
                {x.activo ? "Activo" : "Inactivo"}
              </span>
            ),
          },
        ]}
        tarjetaMovil={(x) => (
          <div className="rounded-xl border border-line bg-surface-raised p-4 shadow-[0_2px_8px_rgba(var(--warm-shadow),0.06)] transition-[border-color] hover:border-brand-500/40">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line bg-surface-soft text-foreground">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth="1.8"
                  aria-hidden="true"
                >
                  <path d="M4 10 5 4h14l1 6" />
                  <rect x="4" y="10" width="16" height="10" rx="1" />
                  <line x1="9" y1="20" x2="9" y2="14" />
                  <line x1="15" y1="14" x2="15" y2="20" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="truncate font-semibold text-base text-foreground">
                    {x.nombre}
                  </h4>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold border tracking-wider ${
                      x.activo
                        ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                        : "bg-zinc-100 text-zinc-600 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"
                    }`}
                  >
                    {x.activo ? "ACTIVO" : "INACTIVO"}
                  </span>
                </div>
                <p className="mt-0.5 text-xs font-semibold text-brand-700 dark:text-brand-400 truncate">
                  {x.cliente.nombre}
                </p>
                <p className="mt-1 flex items-center gap-1 text-xs text-muted truncate">
                  <svg
                    className="h-3.5 w-3.5 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <path d="M12 21c-4-4.6-7-8.3-7-11.5A7 7 0 0 1 19 9.5C19 12.7 16 16.4 12 21z" />
                    <circle cx="12" cy="9.5" r="2.3" />
                  </svg>
                  <span className="truncate">{x.direccion || "Sin dirección"}</span>
                </p>
                {(x.contacto || x.telefono) && (
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted truncate">
                    <svg
                      className="h-3 w-3 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth="2"
                      aria-hidden="true"
                    >
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    <span className="truncate">{x.contacto} {x.telefono ? `· ${x.telefono}` : ""}</span>
                  </p>
                )}
              </div>
            </div>
            <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-line/60 pt-3">
              <button
                type="button"
                className="flex-1 min-h-11 rounded-lg border border-line bg-surface-soft px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface-raised transition-colors flex items-center justify-center gap-1.5"
                onClick={() => setForm(x)}
              >
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Editar
              </button>
              <button
                type="button"
                className="flex-1 min-h-11 rounded-lg border border-line bg-surface-soft px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface-raised transition-colors flex items-center justify-center gap-1.5"
                onClick={() => setPlan(x)}
              >
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                Horarios/Equipo
              </button>
              <button
                type="button"
                className="min-h-11 rounded-lg border border-line bg-surface-soft px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface-raised transition-colors flex items-center justify-center gap-1.5"
                onClick={() => setMapa(x)}
                title="Ver en mapa"
              >
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                  <line x1="8" y1="2" x2="8" y2="18" />
                  <line x1="16" y1="6" x2="16" y2="22" />
                </svg>
                Mapa
              </button>
            </div>
          </div>
        )}
        acciones={(x) => (
          <>
            <button className={btnGhost} onClick={() => setForm(x)}>
              Editar
            </button>
            <button className={btnGhost} onClick={() => setPlan(x)}>
              Horarios y equipo
            </button>
            <button className={btnGhost} onClick={() => setMapa(x)}>
              Mapa
            </button>
          </>
        )}
      />
      <Modal
        titulo={form?.id ? "Editar local" : "Crear local"}
        abierto={!!form}
        onCerrar={() => {
          if (!op.mensaje) setForm(null);
        }}
        ancho="lg"
      >
        {form ? (
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const {
                id,
                clienteId,
                nombre,
                direccion,
                contacto,
                telefono,
                latitud,
                longitud,
                notas,
                activo,
              } = form;
              const data = {
                clienteId,
                nombre,
                direccion,
                contacto,
                telefono,
                latitud,
                longitud,
                notas,
                activo,
              };
              if (
                await op.ejecutar("Guardando local", () =>
                  apiFetch(`/campo/locales${id ? `/${id}` : ""}`, {
                    method: id ? "PUT" : "POST",
                    body: JSON.stringify(data),
                  }),
                )
              ) {
                setForm(null);
                lista.refrescar();
              }
            }}
          >
            <SelectorPaginado
              url="/campo/clientes"
              buscable
              etiqueta="Cliente"
              value={form.clienteId || ""}
              required
              seleccionActual={form.cliente.nombre}
              onChange={(id) => setForm({ ...form, clienteId: Number(id) })}
            />
            <CampoTexto
              titulo="Nombre"
              value={form.nombre}
              required
              onChange={(nombre) => setForm({ ...form, nombre })}
            />
            <CampoTexto
              titulo="Dirección"
              value={form.direccion}
              maxLength={250}
              onChange={(direccion) => setForm({ ...form, direccion })}
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <CampoTexto
                titulo="Latitud"
                type="number"
                step="any"
                min={-90}
                max={90}
                required
                value={form.latitud}
                onChange={(v) => setForm({ ...form, latitud: Number(v) })}
              />
              <CampoTexto
                titulo="Longitud"
                type="number"
                step="any"
                min={-180}
                max={180}
                required
                value={form.longitud}
                onChange={(v) => setForm({ ...form, longitud: Number(v) })}
              />
            </div>
            <SelectorUbicacion
              latitud={form.latitud}
              longitud={form.longitud}
              onChange={(latitud, longitud) =>
                setForm((actual) =>
                  actual ? { ...actual, latitud, longitud } : actual,
                )
              }
            />
            <CampoTexto
              titulo="Contacto"
              value={form.contacto}
              onChange={(contacto) => setForm({ ...form, contacto })}
            />
            <CampoTexto
              titulo="Teléfono"
              value={form.telefono}
              maxLength={40}
              onChange={(telefono) => setForm({ ...form, telefono })}
            />
            <CampoTexto
              titulo="Notas"
              value={form.notas}
              maxLength={1000}
              onChange={(notas) => setForm({ ...form, notas })}
            />
            <CampoActivo
              value={form.activo}
              onChange={(activo) => setForm({ ...form, activo })}
            />
            {op.error ? <p className={errorBox}>{op.error}</p> : null}
            <BotonesFormulario
              ocupado={!!op.mensaje}
              cancelar={() => setForm(null)}
            />
          </form>
        ) : null}
      </Modal>
      {plan ? <PlanLocal local={plan} cerrar={() => setPlan(null)} /> : null}
      {mapa ? <MapaLocal local={mapa} cerrar={() => setMapa(null)} /> : null}
      <PantallaCarga visible={!!op.mensaje} mensaje={op.mensaje} />
    </>
  );
}
