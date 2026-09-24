"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import type {
  Conexion,
  Ejecutable,
  Modulo,
  Pagina,
  TipoEjecutable,
  MotorBd,
} from "@/types/plataforma";
import { MOTORES, TIPOS_EJECUTABLE } from "@/types/plataforma";
import { Modal } from "@/components/modal";
import { IconoMas } from "@/components/icono-mas";
import { BotonEditar } from "@/components/boton-editar";
import { notificarPlataformaActualizada } from "@/lib/eventos-plataforma";
import {
  btnGhost,
  btnPrimary,
  errorBox,
  inputBase,
  labelBase,
} from "@/components/ui";

const BASE = "/admin/plataforma";

export function ModulosPanel() {
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [conexiones, setConexiones] = useState<Conexion[]>([]);
  const [expandido, setExpandido] = useState<Set<number>>(new Set());
  const [cargando, setCargando] = useState(true);

  // Estado de los formularios modales
  const [formModulo, setFormModulo] = useState<Modulo | "nuevo" | null>(null);
  const [formPagina, setFormPagina] = useState<{
    pagina: Pagina | "nuevo";
    moduloId: number;
  } | null>(null);
  const [formEjec, setFormEjec] = useState<{
    ejec: Ejecutable | "nuevo";
    paginaId: number;
  } | null>(null);
  const [aEliminar, setAEliminar] = useState<{
    tipo: "modulo" | "pagina" | "ejecutable";
    id: number;
    nombre: string;
  } | null>(null);
  const [eliminando, setEliminando] = useState(false);
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  async function recargar() {
    const data = await apiFetch<Modulo[]>(`${BASE}/modulos`);
    setModulos(data);
    notificarPlataformaActualizada();
  }

  useEffect(() => {
    Promise.all([
      apiFetch<Modulo[]>(`${BASE}/modulos`),
      apiFetch<Conexion[]>(`${BASE}/conexiones`).catch(() => []),
    ])
      .then(([m, c]) => {
        setModulos(m);
        setConexiones(c);
      })
      .catch((err) =>
        setErrorCarga(
          err instanceof ApiError
            ? err.message
            : "No se pudieron cargar los módulos",
        ),
      )
      .finally(() => setCargando(false));
  }, []);

  function toggle(id: number) {
    setExpandido((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  }

  async function confirmarEliminar() {
    if (!aEliminar || eliminando) return;
    setErrorEliminar(null);
    setEliminando(true);
    const ruta =
      aEliminar.tipo === "modulo"
        ? `modulos/${aEliminar.id}`
        : aEliminar.tipo === "pagina"
          ? `paginas/${aEliminar.id}`
          : `ejecutables/${aEliminar.id}`;
    try {
      await apiFetch(`${BASE}/${ruta}`, { method: "DELETE" });
      await recargar();
      setAEliminar(null);
    } catch (err) {
      setErrorEliminar(
        err instanceof ApiError ? err.message : "No se pudo eliminar",
      );
    } finally {
      setEliminando(false);
    }
  }

  if (cargando) {
    return <p className="text-sm text-zinc-400">Cargando módulos...</p>;
  }

  if (errorCarga) {
    return <p className={errorBox}>{errorCarga}</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {modulos.length} módulos configurados
        </p>
        <button
          type="button"
          onClick={() => setFormModulo("nuevo")}
          aria-label="Crear módulo"
          title="Crear módulo"
          className={`${btnPrimary} h-11 w-11 shrink-0 p-0`}
        >
          <IconoMas className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {modulos.map((m) => (
          <div
            key={m.id}
            className="overflow-hidden rounded-xl border border-line bg-surface-raised"
          >
            <div className="flex items-center gap-2 p-3">
              <button
                type="button"
                onClick={() => toggle(m.id)}
                aria-label={expandido.has(m.id) ? "Contraer" : "Expandir"}
                className="grid h-7 w-7 place-items-center rounded-md text-zinc-400 transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <svg
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className={`h-4 w-4 transition-transform ${expandido.has(m.id) ? "rotate-90" : ""}`}
                  aria-hidden
                >
                  <path
                    fillRule="evenodd"
                    d="M7.21 5.23a.75.75 0 011.06.02l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.04-1.08L11.168 10 7.23 6.29a.75.75 0 01-.02-1.06z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
              <div className="flex-1">
                <p className="font-semibold">
                  {m.nombre} {!m.activo && <Etiqueta>inactivo</Etiqueta>}
                </p>
                <p className="text-xs text-zinc-400">
                  /{m.ruta} · {m.paginas?.length ?? 0} páginas
                </p>
              </div>
              <BotonEditar onClick={() => setFormModulo(m)} etiqueta={`Editar módulo ${m.nombre}`} />
              <BotonIcono
                onClick={() =>
                  setAEliminar({ tipo: "modulo", id: m.id, nombre: m.nombre })
                }
                titulo="Eliminar módulo"
                peligro
              >
                <IconoTacho />
              </BotonIcono>
            </div>

            {expandido.has(m.id) && (
              <div className="border-t border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                    Páginas
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      setFormPagina({ pagina: "nuevo", moduloId: m.id })
                    }
                    aria-label={`Crear página en ${m.nombre}`}
                    title="Crear página"
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-brand-700 transition hover:bg-brand-50 focus-visible:ring-2 focus-visible:ring-brand-600/40 dark:text-brand-400 dark:hover:bg-brand-950"
                  >
                    <IconoMas className="h-5 w-5" />
                  </button>
                </div>
                {(m.paginas ?? []).length === 0 && (
                  <p className="py-2 text-xs text-zinc-400">
                    Sin páginas todavía.
                  </p>
                )}
                <div className="flex flex-col gap-2">
                  {(m.paginas ?? []).map((p) => (
                    <div
                      key={p.id}
                      className="rounded-lg border border-line bg-surface-raised p-2.5"
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <p className="text-sm font-medium">
                            {p.nombre}{" "}
                            {!p.activo && <Etiqueta>inactiva</Etiqueta>}
                          </p>
                          <p className="text-xs text-zinc-400">
                            /{p.ruta} · {p.ejecutables?.length ?? 0} ejecutables
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setFormEjec({ ejec: "nuevo", paginaId: p.id })
                          }
                          aria-label={`Crear ejecutable en ${p.nombre}`}
                          title="Crear ejecutable"
                          className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-brand-700 transition hover:bg-brand-50 focus-visible:ring-2 focus-visible:ring-brand-600/40 dark:text-brand-400 dark:hover:bg-brand-950"
                        >
                          <IconoMas className="h-5 w-5" />
                        </button>
                        <BotonEditar
                          onClick={() => setFormPagina({ pagina: p, moduloId: m.id })}
                          etiqueta={`Editar página ${p.nombre}`}
                        />
                        <BotonIcono
                          onClick={() =>
                            setAEliminar({
                              tipo: "pagina",
                              id: p.id,
                              nombre: p.nombre,
                            })
                          }
                          titulo="Eliminar página"
                          peligro
                        >
                          <IconoTacho />
                        </BotonIcono>
                      </div>

                      {(p.ejecutables ?? []).length > 0 && (
                        <ul className="mt-2 flex flex-col gap-1 border-t border-zinc-100 pt-2 dark:border-zinc-800">
                          {(p.ejecutables ?? []).map((e) => (
                            <li
                              key={e.id}
                              className="flex items-center gap-2 text-xs"
                            >
                              <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                                {e.motor}
                              </span>
                              <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                                {e.tipo}
                              </span>
                              <span className="flex-1 truncate">
                                {e.nombre}
                              </span>
                              <BotonEditar
                                onClick={() => setFormEjec({ ejec: e, paginaId: p.id })}
                                etiqueta={`Editar ejecutable ${e.nombre}`}
                              />
                              <BotonIcono
                                onClick={() =>
                                  setAEliminar({
                                    tipo: "ejecutable",
                                    id: e.id,
                                    nombre: e.nombre,
                                  })
                                }
                                titulo="Eliminar ejecutable"
                                peligro
                              >
                                <IconoTacho />
                              </BotonIcono>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Modales de formularios */}
      {formModulo && (
        <FormModulo
          modulo={formModulo}
          onCerrar={() => setFormModulo(null)}
          onGuardado={async () => {
            setFormModulo(null);
            await recargar();
          }}
        />
      )}
      {formPagina && (
        <FormPagina
          data={formPagina}
          onCerrar={() => setFormPagina(null)}
          onGuardado={async () => {
            setFormPagina(null);
            await recargar();
          }}
        />
      )}
      {formEjec && (
        <FormEjecutable
          data={formEjec}
          conexiones={conexiones}
          onCerrar={() => setFormEjec(null)}
          onGuardado={async () => {
            setFormEjec(null);
            await recargar();
          }}
        />
      )}

      <Modal
        titulo="Confirmar eliminación"
        abierto={aEliminar !== null}
        onCerrar={() => {
          setAEliminar(null);
          setErrorEliminar(null);
        }}
      >
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          ¿Eliminar <span className="font-semibold">{aEliminar?.nombre}</span>?
          {aEliminar?.tipo === "modulo" &&
            " Se eliminarán también sus páginas y ejecutables."}
          {aEliminar?.tipo === "pagina" &&
            " Se eliminarán también sus ejecutables."}
        </p>
        {errorEliminar && <p className={`${errorBox} mt-3`}>{errorEliminar}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setAEliminar(null);
              setErrorEliminar(null);
            }}
            className={btnGhost}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirmarEliminar}
            disabled={eliminando}
            className="inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {eliminando ? "Eliminando..." : "Eliminar"}
          </button>
        </div>
      </Modal>
    </div>
  );
}

// ============================================================
// Formularios
// ============================================================

function FormModulo({
  modulo,
  onCerrar,
  onGuardado,
}: {
  modulo: Modulo | "nuevo";
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const esNuevo = modulo === "nuevo";
  const inicial = modulo === "nuevo" ? null : modulo;
  const [nombre, setNombre] = useState(inicial?.nombre ?? "");
  const [ruta, setRuta] = useState(inicial?.ruta ?? "");
  const [icono, setIcono] = useState(inicial?.icono ?? "");
  const [orden, setOrden] = useState(inicial?.orden ?? 0);
  const [activo, setActivo] = useState(inicial?.activo ?? true);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setGuardando(true);
    try {
      const body = { nombre, ruta, icono: icono || undefined, orden, activo };
      if (inicial === null) {
        await apiFetch(`${BASE}/modulos`, {
          method: "POST",
          body: JSON.stringify(body),
        });
      } else {
        await apiFetch(`${BASE}/modulos/${inicial.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      }
      onGuardado();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error inesperado");
      setGuardando(false);
    }
  }

  return (
    <Modal
      titulo={esNuevo ? "Nuevo módulo" : "Editar módulo"}
      abierto
      onCerrar={onCerrar}
    >
      <form onSubmit={guardar} className="flex flex-col gap-4">
        <label className={labelBase}>
          Nombre
          <input
            className={inputBase}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            autoFocus
          />
        </label>
        <label className={labelBase}>
          Ruta (URL)
          <input
            className={inputBase}
            value={ruta}
            onChange={(e) => setRuta(e.target.value)}
            placeholder="ej: ventas"
            required
          />
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className={labelBase}>
            Ícono (opcional)
            <input
              className={inputBase}
              value={icono}
              onChange={(e) => setIcono(e.target.value)}
              placeholder="ventas, clientes..."
            />
          </label>
          <label className={labelBase}>
            Orden
            <input
              type="number"
              className={inputBase}
              value={orden}
              onChange={(e) => setOrden(Number(e.target.value))}
              min={0}
            />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={activo}
            onChange={(e) => setActivo(e.target.checked)}
            className="h-4 w-4 accent-brand-700"
          />
          Módulo activo
        </label>
        {error && <p className={errorBox}>{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCerrar} className={btnGhost}>
            Cancelar
          </button>
          <button type="submit" disabled={guardando} className={btnPrimary}>
            {guardando ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function FormPagina({
  data,
  onCerrar,
  onGuardado,
}: {
  data: { pagina: Pagina | "nuevo"; moduloId: number };
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const p = data.pagina === "nuevo" ? null : data.pagina;
  const esNuevo = p === null;
  const [nombre, setNombre] = useState(p?.nombre ?? "");
  const [ruta, setRuta] = useState(p?.ruta ?? "");
  const [orden, setOrden] = useState(p?.orden ?? 0);
  const [activo, setActivo] = useState(p?.activo ?? true);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setGuardando(true);
    try {
      if (p === null) {
        await apiFetch(`${BASE}/paginas`, {
          method: "POST",
          body: JSON.stringify({
            moduloId: data.moduloId,
            nombre,
            ruta,
            orden,
            activo,
          }),
        });
      } else {
        await apiFetch(`${BASE}/paginas/${p.id}`, {
          method: "PATCH",
          body: JSON.stringify({ nombre, ruta, orden, activo }),
        });
      }
      onGuardado();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error inesperado");
      setGuardando(false);
    }
  }

  return (
    <Modal
      titulo={esNuevo ? "Nueva página" : "Editar página"}
      abierto
      onCerrar={onCerrar}
    >
      <form onSubmit={guardar} className="flex flex-col gap-4">
        <label className={labelBase}>
          Nombre
          <input
            className={inputBase}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            autoFocus
          />
        </label>
        <label className={labelBase}>
          Ruta (URL dentro del módulo)
          <input
            className={inputBase}
            value={ruta}
            onChange={(e) => setRuta(e.target.value)}
            placeholder="ej: listado"
            required
          />
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className={labelBase}>
            Orden
            <input
              type="number"
              className={inputBase}
              value={orden}
              onChange={(e) => setOrden(Number(e.target.value))}
              min={0}
            />
          </label>
          <label className="flex items-end gap-2 pb-2.5 text-sm">
            <input
              type="checkbox"
              checked={activo}
              onChange={(e) => setActivo(e.target.checked)}
              className="h-4 w-4 accent-brand-700"
            />
            Página activa
          </label>
        </div>
        {error && <p className={errorBox}>{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCerrar} className={btnGhost}>
            Cancelar
          </button>
          <button type="submit" disabled={guardando} className={btnPrimary}>
            {guardando ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function FormEjecutable({
  data,
  conexiones,
  onCerrar,
  onGuardado,
}: {
  data: { ejec: Ejecutable | "nuevo"; paginaId: number };
  conexiones: Conexion[];
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const e0 = data.ejec === "nuevo" ? null : data.ejec;
  const esNuevo = e0 === null;
  const [nombre, setNombre] = useState(e0?.nombre ?? "");
  const [tipo, setTipo] = useState<TipoEjecutable>(e0?.tipo ?? "QUERY");
  const [motor, setMotor] = useState<MotorBd>(e0?.motor ?? "POSTGRESQL");
  const [conexionId, setConexionId] = useState<number | "">(
    e0?.conexionId ?? "",
  );
  const [sentencia, setSentencia] = useState(e0?.sentencia ?? "");
  const [orden, setOrden] = useState(e0?.orden ?? 0);
  const [activo, setActivo] = useState(e0?.activo ?? true);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function guardar(ev: React.FormEvent) {
    ev.preventDefault();
    setError(null);
    setGuardando(true);
    try {
      const body = {
        nombre,
        tipo,
        motor,
        conexionId: conexionId === "" ? null : conexionId,
        sentencia,
        orden,
        activo,
      };
      if (e0 === null) {
        await apiFetch(`${BASE}/ejecutables`, {
          method: "POST",
          body: JSON.stringify({ paginaId: data.paginaId, ...body }),
        });
      } else {
        await apiFetch(`${BASE}/ejecutables/${e0.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      }
      onGuardado();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error inesperado");
      setGuardando(false);
    }
  }

  return (
    <Modal
      titulo={esNuevo ? "Nuevo ejecutable" : "Editar ejecutable"}
      abierto
      onCerrar={onCerrar}
    >
      <form onSubmit={guardar} className="flex flex-col gap-4">
        <label className={labelBase}>
          Nombre
          <input
            className={inputBase}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            autoFocus
          />
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className={labelBase}>
            Tipo
            <select
              className={inputBase}
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoEjecutable)}
            >
              {TIPOS_EJECUTABLE.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.etiqueta}
                </option>
              ))}
            </select>
          </label>
          <label className={labelBase}>
            Motor
            <select
              className={inputBase}
              value={motor}
              onChange={(e) => setMotor(e.target.value as MotorBd)}
            >
              {MOTORES.map((m) => (
                <option key={m.valor} value={m.valor}>
                  {m.etiqueta}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className={labelBase}>
          Conexión (opcional — vacío = base propia de comercIA)
          <select
            className={inputBase}
            value={conexionId}
            onChange={(e) =>
              setConexionId(e.target.value === "" ? "" : Number(e.target.value))
            }
          >
            <option value="">Base propia de comercIA</option>
            {conexiones.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className={labelBase}>
          Sentencia / nombre del procedimiento
          <textarea
            className={`${inputBase} min-h-24 font-mono text-[13px]`}
            value={sentencia}
            onChange={(e) => setSentencia(e.target.value)}
            placeholder="SELECT ... o nombre_del_procedimiento"
            required
          />
        </label>
        {motor !== "POSTGRESQL" && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            El motor {motor} se puede configurar ahora; su ejecución se activa
            cuando esté disponible su driver y servidor.
          </p>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className={labelBase}>
            Orden
            <input
              type="number"
              className={inputBase}
              value={orden}
              onChange={(e) => setOrden(Number(e.target.value))}
              min={0}
            />
          </label>
          <label className="flex items-end gap-2 pb-2.5 text-sm">
            <input
              type="checkbox"
              checked={activo}
              onChange={(e) => setActivo(e.target.checked)}
              className="h-4 w-4 accent-brand-700"
            />
            Activo
          </label>
        </div>
        {error && <p className={errorBox}>{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCerrar} className={btnGhost}>
            Cancelar
          </button>
          <button type="submit" disabled={guardando} className={btnPrimary}>
            {guardando ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ============================================================
// Piezas chicas
// ============================================================

function Etiqueta({ children }: { children: React.ReactNode }) {
  return (
    <span className="ml-1 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500">
      {children}
    </span>
  );
}

function BotonIcono({
  children,
  onClick,
  titulo,
  peligro,
}: {
  children: React.ReactNode;
  onClick: () => void;
  titulo: string;
  peligro?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={titulo}
      aria-label={titulo}
      className={`grid h-8 w-8 place-items-center rounded-lg transition focus-visible:ring-2 focus-visible:ring-brand-600/40 ${
        peligro
          ? "text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400"
          : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
      }`}
    >
      {children}
    </button>
  );
}

function IconoTacho() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-4 w-4"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
        clipRule="evenodd"
      />
    </svg>
  );
}
