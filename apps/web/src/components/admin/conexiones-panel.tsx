"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api";
import { BotonEditar } from "@/components/boton-editar";
import { IconoMas } from "@/components/icono-mas";
import { Modal } from "@/components/modal";
import { Paginacion } from "@/components/paginacion";
import { PantallaCarga } from "@/components/pantalla-carga";
import { confirmar } from "@/components/confirmacion/confirmacion-controller";
import { btnGhost, btnPrimary, errorBox, inputBase, labelBase } from "@/components/ui";
import type { Conexion } from "@/types/plataforma";

const BASE = "/admin/plataforma/conexiones";

const CAMPOS = [
  ["servernode", "Servidor (host:puerto)", 255],
  ["userDb", "Usuario de la base", 120],
  ["serviceLayer", "Service Layer (URL)", 255],
  ["versionTls", "Versión TLS", 20],
] as const;

type Form = Record<"nombre" | "passwordDb" | (typeof CAMPOS)[number][0], string>;

const FORM_INICIAL: Form = { nombre: "", servernode: "", userDb: "", passwordDb: "", serviceLayer: "", versionTls: "" };

/**
 * Conexiones a bases externas que usan los ejecutables. La contraseña es de
 * solo escritura: la API nunca la devuelve, solo si está cargada.
 */
export function ConexionesPanel() {
  const [conexiones, setConexiones] = useState<Conexion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState<Conexion | "nueva" | null>(null);
  const [form, setForm] = useState<Form>(FORM_INICIAL);
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [procesando, setProcesando] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(7);

  const cargar = useCallback(() => {
    apiFetch<Conexion[]>(BASE)
      .then((c) => {
        setConexiones(c);
        setError(null);
      })
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "No se pudieron cargar las conexiones"));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(cargar, 0);
    return () => window.clearTimeout(timer);
  }, [cargar]);

  function abrir(c: Conexion | "nueva") {
    setForm(
      c === "nueva"
        ? FORM_INICIAL
        : {
            nombre: c.nombre,
            servernode: c.servernode ?? "",
            userDb: c.userDb ?? "",
            passwordDb: "",
            serviceLayer: c.serviceLayer ?? "",
            versionTls: c.versionTls ?? "",
          },
    );
    setErrorForm(null);
    setEditando(c);
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!editando) return;
    setProcesando("Guardando conexión");
    setErrorForm(null);
    try {
      await apiFetch(editando === "nueva" ? BASE : `${BASE}/${editando.id}`, {
        method: editando === "nueva" ? "POST" : "PATCH",
        body: JSON.stringify(form),
      });
      setEditando(null);
      cargar();
    } catch (problema) {
      setErrorForm(problema instanceof ApiError ? problema.message : "No se pudo guardar la conexión");
    } finally {
      setProcesando(null);
    }
  }

  async function eliminar(c: Conexion) {
    if (
      !(await confirmar({
        titulo: "Eliminar conexión",
        mensaje: `¿Eliminar la conexión ${c.nombre}? Esta acción no se puede deshacer.`,
        textoConfirmar: "Eliminar",
        peligro: true,
      }))
    )
      return;
    setProcesando("Eliminando conexión");
    try {
      await apiFetch(`${BASE}/${c.id}`, { method: "DELETE" });
      cargar();
    } catch (problema) {
      setError(problema instanceof ApiError ? problema.message : "No se pudo eliminar la conexión");
    } finally {
      setProcesando(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(conexiones.length / limit));
  const pagina = Math.min(page, totalPages);
  const items = conexiones.slice((pagina - 1) * limit, pagina * limit);
  const acciones = (c: Conexion) => (
    <>
      <BotonEditar onClick={() => abrir(c)} etiqueta={`Editar conexión ${c.nombre}`} />
      <button
        type="button"
        onClick={() => void eliminar(c)}
        disabled={c.ejecutables > 0}
        title={c.ejecutables > 0 ? "La usan ejecutables: cambiales la conexión primero" : undefined}
        className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-lg px-3 text-sm font-semibold text-red-700 transition hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-600/40 disabled:cursor-not-allowed disabled:opacity-45 dark:text-red-300 dark:hover:bg-red-950"
      >
        Eliminar
      </button>
    </>
  );

  return (
    <div data-inicio-listado className="w-full min-w-0 scroll-mt-20">
      <PantallaCarga visible={!!procesando} mensaje={procesando ?? "Procesando"} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Conexiones</h1>
          <p className="mt-1 text-sm text-muted">
            Bases externas (SAP HANA, SQL, etc.) que usan los ejecutables de las páginas.
          </p>
        </div>
        <button
          type="button"
          onClick={() => abrir("nueva")}
          aria-label="Crear conexión"
          title="Crear conexión"
          className={`${btnPrimary} h-11 w-11 shrink-0 p-0`}
        >
          <IconoMas className="h-5 w-5" />
        </button>
      </div>

      {error ? <p className={`${errorBox} mt-4`}>{error}</p> : null}

      <ul className="mt-5 space-y-3 md:hidden" aria-label="Conexiones">
        {items.map((c) => (
          <li key={c.id} className="rounded-xl border border-line bg-surface-raised p-4">
            <p className="font-semibold text-foreground">{c.nombre}</p>
            <p className="mt-1 break-words text-xs text-muted">
              {c.servernode ?? "Sin servidor"} · {c.userDb ?? "Sin usuario"}
            </p>
            <p className="mt-1 text-xs text-muted">
              Contraseña {c.tienePassword ? "cargada" : "sin cargar"} · {c.ejecutables} ejecutables
            </p>
            <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">{acciones(c)}</div>
          </li>
        ))}
      </ul>

      <div className="mt-5 hidden overflow-x-auto rounded-xl border border-line bg-surface-raised md:block">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Conexiones</caption>
          <thead className="bg-surface-soft text-xs font-semibold uppercase text-foreground">
            <tr>
              <th className="px-4 py-3">Conexión</th>
              <th className="px-4 py-3">Usuario</th>
              <th className="px-4 py-3">Service Layer · TLS</th>
              <th className="px-4 py-3">Contraseña</th>
              <th className="px-4 py-3 text-center">Ejecutables</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {items.map((c) => (
              <tr key={c.id} className="hover:bg-surface-soft">
                <td className="px-4 py-3">
                  <p className="font-semibold text-foreground">{c.nombre}</p>
                  <p className="text-xs text-muted">{c.servernode ?? "Sin servidor"}</p>
                </td>
                <td className="px-4 py-3">{c.userDb ?? "—"}</td>
                <td className="px-4 py-3">
                  {c.serviceLayer ?? "—"} · {c.versionTls ?? "—"}
                </td>
                <td className="px-4 py-3">{c.tienePassword ? "Cargada" : "Sin cargar"}</td>
                <td className="px-4 py-3 text-center">{c.ejecutables}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">{acciones(c)}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!conexiones.length && !error ? (
        <p className="mt-4 text-sm text-muted">Todavía no hay conexiones.</p>
      ) : null}
      {conexiones.length ? (
        <Paginacion
          page={pagina}
          totalPages={totalPages}
          total={conexiones.length}
          limit={limit}
          onPageChange={setPage}
          onLimitChange={(l) => {
            setLimit(l);
            setPage(1);
          }}
        />
      ) : null}

      <Modal
        titulo={editando === "nueva" ? "Crear conexión" : "Editar conexión"}
        abierto={editando !== null}
        onCerrar={() => setEditando(null)}
      >
        <form onSubmit={guardar} className="flex flex-col gap-4">
          <label className={labelBase}>
            Nombre
            <input
              value={form.nombre}
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
              minLength={2}
              maxLength={80}
              required
              className={inputBase}
            />
          </label>
          {CAMPOS.map(([campo, etiqueta, largo]) => (
            <label key={campo} className={labelBase}>
              {etiqueta} (opcional)
              <input
                value={form[campo]}
                onChange={(e) => setForm((f) => ({ ...f, [campo]: e.target.value }))}
                maxLength={largo}
                className={inputBase}
              />
            </label>
          ))}
          <label className={labelBase}>
            Contraseña de la base
            <input
              type="password"
              autoComplete="new-password"
              value={form.passwordDb}
              onChange={(e) => setForm((f) => ({ ...f, passwordDb: e.target.value }))}
              maxLength={255}
              placeholder={
                editando !== "nueva" && editando?.tienePassword ? "Dejala vacía para conservar la actual" : "Opcional"
              }
              className={inputBase}
            />
          </label>
          {errorForm ? <p className={errorBox}>{errorForm}</p> : null}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditando(null)} className={btnGhost}>
              Cancelar
            </button>
            <button type="submit" disabled={!!procesando} className={btnPrimary}>
              Guardar
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
