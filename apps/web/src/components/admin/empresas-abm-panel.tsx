"use client";

import { useCallback, useEffect, useState } from "react";
import { IconoMas } from "@/components/icono-mas";
import { BotonEditar } from "@/components/boton-editar";
import { Modal } from "@/components/modal";
import { Paginacion } from "@/components/paginacion";
import {
  btnGhost,
  btnPrimary,
  errorBox,
  inputBase,
  labelBase,
} from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api";
import type { EmpresaAdmin } from "@/types/empresa";
import type { RespuestaPaginada } from "@/types/paginacion";

interface FormEmpresa {
  nombre: string;
  sapEsquema: string;
  sapUsuario: string;
  sapContrasenia: string;
  diasAvisoVencimiento: string;
}

const FORM_INICIAL: FormEmpresa = {
  nombre: "",
  sapEsquema: "",
  sapUsuario: "",
  sapContrasenia: "",
  diasAvisoVencimiento: "5",
};

const CAMPOS_SAP = [
  ["sapEsquema", "SAP esquema", "Ej.: SBO_EMPRESA"],
  ["sapUsuario", "SAP usuario", "Ej.: B1USER"],
] as const;

function ListaEmpresasMovil({
  empresas,
  onEditar,
  onEliminar,
}: {
  empresas: EmpresaAdmin[];
  onEditar: (empresa: EmpresaAdmin) => void;
  onEliminar: (empresa: EmpresaAdmin) => void;
}) {
  return (
    <ul className="mt-5 space-y-3 md:hidden" aria-label="Empresas">
      {empresas.map((empresa) => {
        const tieneDatos =
          empresa.usuariosCount > 0 ||
          empresa.configuracionCount > 0 ||
          empresa.hijasCount > 0;
        return (
          <li
            key={empresa.id}
            className="rounded-xl border border-line bg-surface-raised p-4 [content-visibility:auto]"
          >
            <p className="font-semibold text-foreground">{empresa.nombre}</p>
            <p className="mt-1 text-xs text-muted">
              Matriz: {empresa.padre?.nombre ?? "Sin empresa matriz"}
            </p>
            {empresa.dbName ? (
              <p className="mt-1 text-xs text-muted">Base: {empresa.dbName}</p>
            ) : null}
            <p className="mt-1 text-xs text-muted">
              Aviso de vencimiento: {empresa.diasAvisoVencimiento} días antes
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-line pt-3 text-center text-xs">
              <p className="rounded-lg bg-surface-soft px-2 py-2 text-muted">
                <strong className="block text-sm text-foreground">
                  {empresa.usuariosCount}
                </strong>
                usuarios
              </p>
              <p className="rounded-lg bg-surface-soft px-2 py-2 text-muted">
                <strong className="block text-sm text-foreground">
                  {empresa.configuracionCount}
                </strong>
                accesos
              </p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <BotonEditar onClick={() => onEditar(empresa)} etiqueta={`Editar empresa ${empresa.nombre}`} modo="texto" />
              <button
                type="button"
                onClick={() => onEliminar(empresa)}
                disabled={tieneDatos}
                title={
                  tieneDatos ? "La empresa tiene datos asociados" : undefined
                }
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-red-300 px-3 text-sm font-semibold text-red-700 transition hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-600/40 disabled:cursor-not-allowed disabled:opacity-45 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950"
              >
                Eliminar
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function EmpresasAbmPanel() {
  const [datos, setDatos] = useState<RespuestaPaginada<EmpresaAdmin> | null>(
    null,
  );
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(7);
  const [editando, setEditando] = useState<EmpresaAdmin | "nueva" | null>(null);
  const [eliminando, setEliminando] = useState<EmpresaAdmin | null>(null);
  const [form, setForm] = useState<FormEmpresa>(FORM_INICIAL);
  const [error, setError] = useState<string | null>(null);
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [borrando, setBorrando] = useState(false);

  const cargar = useCallback(() => {
    return apiFetch<RespuestaPaginada<EmpresaAdmin>>(
      `/admin/empresas?page=${page}&limit=${limit}`,
    )
      .then((respuesta) => {
        setDatos(respuesta);
        setError(null);
      })
      .catch((problema) =>
        setError(
          problema instanceof ApiError
            ? problema.message
            : "No se pudieron cargar las empresas",
        ),
      );
  }, [limit, page]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const empresas = datos?.items ?? [];

  function abrir(empresa: EmpresaAdmin | "nueva") {
    setForm(
      empresa === "nueva"
        ? FORM_INICIAL
        : {
            nombre: empresa.nombre,
            sapEsquema: empresa.sapEsquema ?? "",
            sapUsuario: empresa.sapUsuario ?? "",
            sapContrasenia: "",
            diasAvisoVencimiento: String(empresa.diasAvisoVencimiento),
          },
    );
    setError(null);
    setEditando(empresa);
  }

  async function guardar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!editando) return;
    setGuardando(true);
    setError(null);
    try {
      await apiFetch(
        editando === "nueva"
          ? "/admin/empresas"
          : `/admin/empresas/${editando.id}`,
        {
          method: editando === "nueva" ? "POST" : "PATCH",
          body: JSON.stringify({
            nombre: form.nombre.trim(),
            sapEsquema: form.sapEsquema.trim() || null,
            sapUsuario: form.sapUsuario.trim() || null,
            // Vacía conserva la contraseña actual.
            ...(form.sapContrasenia
              ? { sapContrasenia: form.sapContrasenia }
              : {}),
            diasAvisoVencimiento: Number(form.diasAvisoVencimiento),
          }),
        },
      );
      setEditando(null);
      await cargar();
    } catch (problema) {
      setError(
        problema instanceof ApiError
          ? problema.message
          : "No se pudo guardar la empresa",
      );
    } finally {
      setGuardando(false);
    }
  }

  async function confirmarEliminar() {
    if (!eliminando || borrando) return;
    setBorrando(true);
    setErrorEliminar(null);
    try {
      await apiFetch(`/admin/empresas/${eliminando.id}`, { method: "DELETE" });
      setEliminando(null);
      if (empresas.length === 1 && page > 1) setPage((actual) => actual - 1);
      else await cargar();
    } catch (problema) {
      setErrorEliminar(
        problema instanceof ApiError
          ? problema.message
          : "No se pudo eliminar la empresa",
      );
    } finally {
      setBorrando(false);
    }
  }

  return (
    <div data-inicio-listado className="w-full min-w-0 scroll-mt-20">
      <div className="flex items-center justify-between gap-3">
        <h2 className="min-w-0 text-xl font-bold tracking-tight">Empresas</h2>
        <button
          type="button"
          onClick={() => abrir("nueva")}
          aria-label="Crear empresa"
          title="Crear empresa"
          className={`${btnPrimary} h-11 w-11 shrink-0 p-0`}
        >
          <IconoMas className="h-5 w-5" />
        </button>
      </div>

      {error && !editando ? (
        <p className={`${errorBox} mt-4`}>{error}</p>
      ) : null}

      {empresas.length === 0 ? (
        <p className="mt-5 rounded-xl border border-dashed border-line bg-surface-raised px-4 py-10 text-center text-sm text-muted">
          Todavía no hay empresas cargadas.
        </p>
      ) : (
        <>
          <ListaEmpresasMovil
            empresas={empresas}
            onEditar={abrir}
            onEliminar={(empresa) => {
              setErrorEliminar(null);
              setEliminando(empresa);
            }}
          />
          <div className="mt-5 hidden overflow-x-auto rounded-xl border border-line bg-surface-raised md:block">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="bg-surface-soft">
                <tr className="border-b border-line text-xs font-semibold uppercase tracking-wide text-foreground">
                  <th className="px-4 py-3 font-medium">Empresa</th>
                  <th className="px-4 py-3 font-medium">Matriz</th>
                  <th className="px-4 py-3 text-center font-medium">
                    Usuarios
                  </th>
                  <th className="px-4 py-3 text-center font-medium">Accesos</th>
                  <th className="px-4 py-3 text-center font-medium">Aviso venc.</th>
                  <th className="px-4 py-3 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {empresas.map((empresa) => {
                  const tieneDatos =
                    empresa.usuariosCount > 0 ||
                    empresa.configuracionCount > 0 ||
                    empresa.hijasCount > 0;
                  return (
                    <tr
                      key={empresa.id}
                      className="border-b border-line last:border-0 hover:bg-surface-soft"
                    >
                      <td className="px-4 py-3">
                        <p className="font-semibold text-foreground">
                          {empresa.nombre}
                        </p>
                        {empresa.dbName ? (
                          <p className="mt-0.5 text-xs text-muted">
                            {empresa.dbName}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {empresa.padre?.nombre ?? "Sin empresa matriz"}
                      </td>
                      <td className="px-4 py-3 text-center [font-variant-numeric:tabular-nums]">
                        {empresa.usuariosCount}
                      </td>
                      <td className="px-4 py-3 text-center [font-variant-numeric:tabular-nums]">
                        {empresa.configuracionCount}
                      </td>
                      <td className="px-4 py-3 text-center [font-variant-numeric:tabular-nums]">
                        {empresa.diasAvisoVencimiento} días
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <BotonEditar onClick={() => abrir(empresa)} etiqueta={`Editar empresa ${empresa.nombre}`} />
                          <button
                            type="button"
                            onClick={() => {
                              setErrorEliminar(null);
                              setEliminando(empresa);
                            }}
                            disabled={tieneDatos}
                            className="inline-flex min-h-11 items-center justify-center rounded-lg px-3 text-sm font-semibold text-red-700 transition hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-600/40 disabled:cursor-not-allowed disabled:opacity-45 dark:text-red-300 dark:hover:bg-red-950"
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {datos && datos.total > 0 ? (
        <Paginacion
          page={datos.page}
          totalPages={datos.totalPages}
          total={datos.total}
          limit={datos.limit}
          onPageChange={setPage}
          onLimitChange={(nuevo) => {
            setLimit(nuevo);
            setPage(1);
          }}
        />
      ) : null}

      <Modal
        titulo={editando === "nueva" ? "Crear empresa" : "Editar empresa"}
        abierto={editando !== null}
        onCerrar={() => setEditando(null)}
      >
        <form onSubmit={guardar} className="flex flex-col gap-4">
          <label className={labelBase}>
            Nombre
            <input
              value={form.nombre}
              onChange={(evento) =>
                setForm((actual) => ({
                  ...actual,
                  nombre: evento.target.value,
                }))
              }
              minLength={2}
              maxLength={120}
              required
              className={inputBase}
            />
          </label>
          <label className={labelBase}>
            Aviso de vencimiento del inventario (días antes)
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={90}
              required
              value={form.diasAvisoVencimiento}
              onChange={(evento) =>
                setForm((actual) => ({
                  ...actual,
                  diasAvisoVencimiento: evento.target.value,
                }))
              }
              className={inputBase}
            />
          </label>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {CAMPOS_SAP.map(([campo, etiqueta, ejemplo]) => (
              <label key={campo} className={labelBase}>
                {etiqueta}
                <input
                  value={form[campo]}
                  onChange={(evento) =>
                    setForm((actual) => ({
                      ...actual,
                      [campo]: evento.target.value,
                    }))
                  }
                  maxLength={100}
                  autoComplete="off"
                  placeholder={ejemplo}
                  className={inputBase}
                />
              </label>
            ))}
          </div>
          <label className={labelBase}>
            SAP contraseña
            <input
              type="password"
              autoComplete="new-password"
              value={form.sapContrasenia}
              onChange={(evento) =>
                setForm((actual) => ({
                  ...actual,
                  sapContrasenia: evento.target.value,
                }))
              }
              maxLength={100}
              placeholder={
                editando !== "nueva" && editando?.tieneSapContrasenia
                  ? "Dejala vacía para conservar la actual"
                  : "Opcional"
              }
              className={inputBase}
            />
          </label>
          {error ? <p className={errorBox}>{error}</p> : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setEditando(null)}
              className={btnGhost}
            >
              Cancelar
            </button>
            <button type="submit" disabled={guardando} className={btnPrimary}>
              {guardando ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        titulo="Eliminar empresa"
        abierto={eliminando !== null}
        onCerrar={() => setEliminando(null)}
      >
        <p className="text-sm text-muted">
          {eliminando ? (
            <>
              ¿Eliminar{" "}
              <strong className="text-foreground">{eliminando.nombre}</strong>?
              Esta acción no se puede deshacer.
            </>
          ) : null}
        </p>
        {errorEliminar ? (
          <p className={`${errorBox} mt-3`}>{errorEliminar}</p>
        ) : null}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => setEliminando(null)}
            className={btnGhost}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void confirmarEliminar()}
            disabled={borrando}
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-700 focus-visible:ring-2 focus-visible:ring-red-600/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {borrando ? "Eliminando..." : "Eliminar"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
