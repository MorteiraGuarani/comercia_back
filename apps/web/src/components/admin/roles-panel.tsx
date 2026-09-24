"use client";

import { useCallback, useEffect, useState } from "react";
import { SelectorPaginado } from "@/components/selector-paginado";
import { PantallaCarga } from "@/components/pantalla-carga";
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
import type { RespuestaPaginada } from "@/types/paginacion";
import type { RolAdmin, FormRol } from "@/types/rol";

const FORM_INICIAL: FormRol = { empresaId: "", descripcion: "", rolId: "" };

function ListaRolesMovil({
  roles,
  onEditar,
  onEliminar,
}: {
  roles: RolAdmin[];
  onEditar: (rol: RolAdmin) => void;
  onEliminar: (rol: RolAdmin) => void;
}) {
  return (
    <ul className="mt-5 space-y-3 md:hidden" aria-label="Roles">
      {roles.map((rol) => {
        const enUso = rol.usuariosCount > 0 || rol.hijosCount > 0;
        return (
          <li
            key={rol.id}
            className="rounded-xl border border-line bg-surface-raised p-4 [content-visibility:auto]"
          >
            <p className="font-semibold text-foreground">{rol.descripcion}</p>
            <p className="mt-1 text-sm text-muted">{rol.empresa.nombre}</p>
            <p className="mt-1 text-xs text-muted">
              Superior: {rol.padre?.descripcion ?? "Sin superior"}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-line pt-3 text-center text-xs">
              <p className="rounded-lg bg-surface-soft px-2 py-2 text-muted">
                <strong className="block text-sm text-foreground">
                  {rol.usuariosCount}
                </strong>
                usuarios
              </p>
              <p className="rounded-lg bg-surface-soft px-2 py-2 text-muted">
                <strong className="block text-sm text-foreground">
                  {rol.hijosCount}
                </strong>
                roles subordinados
              </p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <BotonEditar onClick={() => onEditar(rol)} etiqueta={`Editar rol ${rol.descripcion}`} modo="texto" />
              <button
                type="button"
                onClick={() => onEliminar(rol)}
                disabled={enUso}
                title={
                  enUso
                    ? "El rol tiene usuarios o roles subordinados"
                    : undefined
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

export function RolesPanel() {
  const [datos, setDatos] = useState<RespuestaPaginada<RolAdmin> | null>(null);
  const [empresaId, setEmpresaId] = useState<number | "">("");
  const [consultaTerminada, setConsultaTerminada] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(7);
  const [editando, setEditando] = useState<RolAdmin | "nuevo" | null>(null);
  const [eliminando, setEliminando] = useState<RolAdmin | null>(null);
  const [form, setForm] = useState<FormRol>(FORM_INICIAL);
  const [error, setError] = useState<string | null>(null);
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const consulta = `/admin/roles?page=${page}&limit=${limit}${empresaId === "" ? "" : `&empresaId=${empresaId}`}`;
  const cargando = consultaTerminada !== consulta;

  const cargar = useCallback(() => {
    return apiFetch<RespuestaPaginada<RolAdmin>>(consulta)
      .then((respuesta) => {
        setDatos(respuesta);
        setError(null);
      })
      .catch((problema) =>
        setError(
          problema instanceof ApiError
            ? problema.message
            : "No se pudieron cargar los roles",
        ),
      )
      .finally(() => setConsultaTerminada(consulta));
  }, [consulta]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const roles = datos?.items ?? [];

  function abrir(rol: RolAdmin | "nuevo") {
    setForm(
      rol === "nuevo"
        ? { ...FORM_INICIAL, empresaId }
        : {
            empresaId: rol.empresa.id,
            descripcion: rol.descripcion,
            rolId: rol.padre?.id ?? "",
          },
    );
    setError(null);
    setEditando(rol);
  }

  async function guardar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!editando || guardando || form.empresaId === "") return;
    setGuardando(true);
    setError(null);
    try {
      await apiFetch(
        editando === "nuevo" ? "/admin/roles" : `/admin/roles/${editando.id}`,
        {
          method: editando === "nuevo" ? "POST" : "PATCH",
          body: JSON.stringify({
            ...(editando === "nuevo" ? { empresaId: form.empresaId } : {}),
            descripcion: form.descripcion.trim(),
            rolId: form.rolId === "" ? null : form.rolId,
          }),
        },
      );
      setEditando(null);
      await cargar();
    } catch (problema) {
      setError(
        problema instanceof ApiError
          ? problema.message
          : "No se pudo guardar el rol",
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
      await apiFetch(`/admin/roles/${eliminando.id}`, { method: "DELETE" });
      setEliminando(null);
      if (roles.length === 1 && page > 1) setPage((actual) => actual - 1);
      else await cargar();
    } catch (problema) {
      setErrorEliminar(
        problema instanceof ApiError
          ? problema.message
          : "No se pudo eliminar el rol",
      );
    } finally {
      setBorrando(false);
    }
  }

  const idEditando = typeof editando === "object" ? editando?.id : undefined;

  return (
    <div data-inicio-listado className="w-full min-w-0 scroll-mt-20">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Roles</h2>
          <p className="mt-1 text-sm text-muted">
            Definí los roles y su jerarquía dentro de cada empresa.
          </p>
        </div>
        <button
          type="button"
          onClick={() => abrir("nuevo")}
          aria-label="Crear rol"
          title="Crear rol"
          className={`${btnPrimary} h-11 w-11 shrink-0 p-0`}
        >
          <IconoMas className="h-5 w-5" />
        </button>
      </div>

      <PantallaCarga
        visible={cargando || guardando || borrando}
        mensaje={
          guardando
            ? "Guardando rol"
            : borrando
              ? "Eliminando rol"
              : "Cargando roles"
        }
      />
      <div className="mt-4 max-w-lg">
        <SelectorPaginado
          url="/admin/empresas"
          etiqueta="Filtrar por empresa"
          value={empresaId}
          vacio="Todas las empresas"
          onChange={(id) => {
            setEmpresaId(id);
            setPage(1);
          }}
        />
      </div>

      {error && !editando ? (
        <p className={`${errorBox} mt-4`}>{error}</p>
      ) : null}

      {roles.length === 0 ? (
        <p className="mt-5 rounded-xl border border-dashed border-line bg-surface-raised px-4 py-10 text-center text-sm text-muted">
          Todavía no hay roles cargados.
        </p>
      ) : (
        <>
          <ListaRolesMovil
            roles={roles}
            onEditar={abrir}
            onEliminar={(rol) => {
              setErrorEliminar(null);
              setEliminando(rol);
            }}
          />
          <div className="mt-5 hidden overflow-x-auto rounded-xl border border-line bg-surface-raised md:block">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-surface-soft">
                <tr className="border-b border-line text-xs font-semibold uppercase tracking-wide text-foreground">
                  <th className="px-4 py-3 font-medium">Rol</th>
                  <th className="px-4 py-3 font-medium">Empresa</th>
                  <th className="px-4 py-3 font-medium">Superior</th>
                  <th className="px-4 py-3 text-center font-medium">
                    Usuarios
                  </th>
                  <th className="px-4 py-3 text-center font-medium">
                    Subordinados
                  </th>
                  <th className="px-4 py-3 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((rol) => {
                  const enUso = rol.usuariosCount > 0 || rol.hijosCount > 0;
                  return (
                    <tr
                      key={rol.id}
                      className="border-b border-line last:border-0 hover:bg-surface-soft"
                    >
                      <td className="px-4 py-3 font-semibold text-foreground">
                        {rol.descripcion}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {rol.empresa.nombre}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {rol.padre?.descripcion ?? "Sin superior"}
                      </td>
                      <td className="px-4 py-3 text-center [font-variant-numeric:tabular-nums]">
                        {rol.usuariosCount}
                      </td>
                      <td className="px-4 py-3 text-center [font-variant-numeric:tabular-nums]">
                        {rol.hijosCount}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <BotonEditar onClick={() => abrir(rol)} etiqueta={`Editar rol ${rol.descripcion}`} />
                          <button
                            type="button"
                            onClick={() => {
                              setErrorEliminar(null);
                              setEliminando(rol);
                            }}
                            disabled={enUso}
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
        titulo={editando === "nuevo" ? "Crear rol" : "Editar rol"}
        abierto={editando !== null}
        onCerrar={() => {
          if (!guardando) setEditando(null);
        }}
      >
        <form onSubmit={guardar} className="flex flex-col gap-4">
          {editando === "nuevo" ? (
            <SelectorPaginado
              url="/admin/empresas"
              etiqueta="Empresa"
              value={form.empresaId}
              required
              vacio="Seleccioná una empresa"
              onChange={(id) =>
                setForm((actual) => ({ ...actual, empresaId: id, rolId: "" }))
              }
            />
          ) : editando ? (
            <p className="text-sm text-muted">
              Empresa:{" "}
              <strong className="text-foreground">
                {editando.empresa.nombre}
              </strong>
            </p>
          ) : null}
          <label className={labelBase}>
            Descripción
            <input
              value={form.descripcion}
              onChange={(evento) =>
                setForm((actual) => ({
                  ...actual,
                  descripcion: evento.target.value,
                }))
              }
              minLength={2}
              maxLength={120}
              required
              className={inputBase}
            />
          </label>
          {editando && form.empresaId !== "" ? (
            <SelectorPaginado
              key={`${form.empresaId}-${idEditando ?? "nuevo"}`}
              url={`/admin/roles?empresaId=${form.empresaId}`}
              etiqueta="Rol superior"
              value={form.rolId}
              vacio="Sin superior"
              excluirId={idEditando}
              seleccionActual={
                editando !== "nuevo" ? editando.padre?.descripcion : undefined
              }
              onChange={(id) => setForm((actual) => ({ ...actual, rolId: id }))}
            />
          ) : null}
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
        titulo="Eliminar rol"
        abierto={eliminando !== null}
        onCerrar={() => setEliminando(null)}
      >
        <p className="text-sm text-muted">
          {eliminando ? (
            <>
              ¿Eliminar el rol{" "}
              <strong className="text-foreground">
                {eliminando.descripcion}
              </strong>
              ? Esta acción no se puede deshacer.
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
