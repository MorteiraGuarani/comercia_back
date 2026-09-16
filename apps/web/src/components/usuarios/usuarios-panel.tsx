"use client";

import { calcularDvRucPy } from "@/utils/ruc";

/* Hallmark · administración de usuarios en tarjetas táctiles para móvil. */

import { useCallback, useEffect, useState } from "react";
import type { CountryCode } from "libphonenumber-js";
import { apiFetch, ApiError } from "@/lib/api";
import { SelectorPaginado } from "@/components/selector-paginado";
import { IconoMas } from "@/components/icono-mas";
import type { RespuestaPaginada } from "@/types/paginacion";
import type {
  MetaUsuarios,
  UsuarioAdmin,
  UsuarioLocalAsignacion,
} from "@/types/usuario";
import { Modal } from "@/components/modal";
import { Paginacion } from "@/components/paginacion";
import { PantallaCarga } from "@/components/pantalla-carga";
import {
  btnGhost,
  btnPrimary,
  errorBox,
  inputBase,
  labelBase,
} from "@/components/ui";

interface FormUsuario {
  nombre: string;
  apellido: string;
  correo: string;
  nombreLogin: string;
  ruc: string;
  celularPais: CountryCode;
  celular: string;
  password: string;
  rolId: number | "";
  superiorId: number | "";
  esSuperadmin: boolean;
  isActive: boolean;
}

interface UsuariosPanelProps {
  soloSuperadmin?: boolean;
}

const FORM_INICIAL: FormUsuario = {
  nombre: "",
  apellido: "",
  correo: "",
  nombreLogin: "",
  ruc: "",
  celularPais: "PY",
  celular: "",
  password: "",
  rolId: "",
  superiorId: "",
  esSuperadmin: false,
  isActive: true,
};

function ListaUsuariosMovil({
  usuarios,
  onEditar,
  onLocales,
  onEliminar,
}: {
  usuarios: UsuarioAdmin[];
  onEditar: (usuario: UsuarioAdmin) => void;
  onLocales: (usuario: UsuarioAdmin) => void;
  onEliminar?: (usuario: UsuarioAdmin) => void;
}) {
  return (
    <ul className="mt-5 space-y-3 md:hidden" aria-label="Usuarios">
      {usuarios.map((usuario) => (
        <li
          key={usuario.id}
          className="rounded-xl border border-line bg-surface-raised p-4 [content-visibility:auto]"
        >
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-semibold text-foreground">
                {usuario.nombre} {usuario.apellido}
              </p>
              <p className="mt-0.5 truncate text-xs text-muted">
                {usuario.correo}
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                usuario.isActive
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                  : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
              }`}
            >
              {usuario.isActive ? "Activo" : "Inactivo"}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-line pt-3 text-xs">
            <p className="rounded-lg bg-surface-soft px-2.5 py-2 text-muted">
              Rol:{" "}
              <strong className="text-foreground">
                {usuario.esSuperadmin
                  ? "Superadmin"
                  : (usuario.rol?.descripcion ?? "Sin rol")}
              </strong>
            </p>
            <p className="truncate rounded-lg bg-surface-soft px-2.5 py-2 text-muted">
              Superior:{" "}
              <strong className="text-foreground">
                {usuario.superior?.nombre ?? "Sin superior"}
              </strong>
            </p>
          </div>
          {usuario.esSuperadmin ? (
            <p className="mt-3 rounded-lg bg-surface-soft px-3 py-2 text-center text-xs font-medium text-muted">
              Cuenta superadmin protegida
            </p>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onLocales(usuario)}
                className={`${btnGhost} mt-3 min-h-11 w-full whitespace-nowrap`}
              >
                Gestionar locales
              </button>
              <button
                type="button"
                onClick={() => onEditar(usuario)}
                className={`${btnGhost} mt-2 min-h-11 w-full whitespace-nowrap`}
              >
                Editar usuario
              </button>
              {onEliminar ? (
                <button
                  type="button"
                  onClick={() => onEliminar(usuario)}
                  className="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-red-300 px-3 text-sm font-semibold text-red-700 transition hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-600/40 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950"
                >
                  Desactivar usuario
                </button>
              ) : null}
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

export function UsuariosPanel({ soloSuperadmin = false }: UsuariosPanelProps) {
  const [meta, setMeta] = useState<MetaUsuarios | null>(null);
  const [empresaId, setEmpresaId] = useState<number | "">("");
  const [datos, setDatos] = useState<RespuestaPaginada<UsuarioAdmin> | null>(
    null,
  );
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(7);
  const [editando, setEditando] = useState<UsuarioAdmin | "nuevo" | null>(null);
  const [form, setForm] = useState<FormUsuario>(FORM_INICIAL);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [eliminando, setEliminando] = useState<UsuarioAdmin | null>(null);
  const [desactivando, setDesactivando] = useState(false);
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null);
  const [localesUsuario, setLocalesUsuario] = useState<UsuarioAdmin | null>(
    null,
  );
  const base = soloSuperadmin ? "/admin/usuarios" : "/usuarios";

  const cargar = useCallback(() => {
    if (empresaId === "") return;
    apiFetch<RespuestaPaginada<UsuarioAdmin>>(
      `${base}?page=${page}&limit=${limit}&empresaId=${empresaId}`,
    )
      .then(setDatos)
      .catch((e) =>
        setError(
          e instanceof ApiError
            ? e.message
            : "No se pudieron cargar los usuarios",
        ),
      );
  }, [base, empresaId, page, limit]);

  useEffect(() => {
    apiFetch<MetaUsuarios>(`${base}/meta`)
      .then((data) => {
        setMeta(data);
        setEmpresaId(data.empresas[0]?.id ?? "");
      })
      .catch((e) =>
        setError(
          e instanceof ApiError ? e.message : "No tenés acceso a usuarios",
        ),
      );
  }, [base]);

  useEffect(() => {
    const timer = window.setTimeout(cargar, 0);
    return () => window.clearTimeout(timer);
  }, [cargar]);

  function abrirNuevo() {
    setForm({ ...FORM_INICIAL, rolId: "" });
    setError(null);
    setEditando("nuevo");
  }

  function abrirEditar(usuario: UsuarioAdmin) {
    setForm({
      ...FORM_INICIAL,
      rolId: usuario.rol?.id ?? "",
      superiorId: usuario.superior?.id ?? "",
      isActive: usuario.isActive,
    });
    setError(null);
    setEditando(usuario);
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (empresaId === "" || form.rolId === "" || editando === null) return;
    setGuardando(true);
    setError(null);
    try {
      let creado: UsuarioAdmin | null = null;
      if (editando === "nuevo") {
        creado = await apiFetch<UsuarioAdmin>(base, {
          method: "POST",
          body: JSON.stringify({
            empresaId,
            nombre: form.nombre.trim(),
            apellido: form.apellido.trim(),
            correo: form.correo.trim().toLowerCase(),
            nombreLogin: form.nombreLogin.trim().toLowerCase(),
            ruc: `${form.ruc}-${calcularDvRucPy(form.ruc)}`,
            celularPais: form.celularPais,
            celular: form.celular.trim(),
            password: form.password,
            rolId: form.rolId,
            superiorId: form.superiorId === "" ? null : form.superiorId,
            esSuperadmin: form.esSuperadmin,
          }),
        });
      } else {
        await apiFetch(`${base}/${editando.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            rolId: form.rolId,
            superiorId: form.superiorId === "" ? null : form.superiorId,
            isActive: form.isActive,
            ...(form.password ? { password: form.password } : {}),
          }),
        });
      }
      setEditando(null);
      cargar();
      if (creado && !creado.esSuperadmin) setLocalesUsuario(creado);
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "No se pudo guardar el usuario",
      );
    } finally {
      setGuardando(false);
    }
  }

  async function confirmarDesactivacion() {
    if (!eliminando || desactivando) return;
    setDesactivando(true);
    setErrorEliminar(null);
    try {
      await apiFetch(`${base}/${eliminando.id}`, { method: "DELETE" });
      setEliminando(null);
      if (datos?.items.length === 1 && page > 1) {
        setPage((actual) => actual - 1);
      } else {
        cargar();
      }
    } catch (problema) {
      setErrorEliminar(
        problema instanceof ApiError
          ? problema.message
          : "No se pudo desactivar el usuario",
      );
    } finally {
      setDesactivando(false);
    }
  }

  const usuarios = datos?.items ?? [];
  const superiores = usuarios.filter(
    (u) => editando === "nuevo" || u.id !== editando?.id,
  );

  return (
    <div className="w-full min-w-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            {soloSuperadmin ? "Usuarios de empresas" : "Usuarios"}
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Creá impulsadores, administradores y superadmins; asigná superiores,
            locales y las tareas que reciben en su agenda.
          </p>
        </div>
        <button
          type="button"
          onClick={abrirNuevo}
          aria-label="Crear usuario"
          title="Crear usuario"
          className={`${btnPrimary} h-11 w-11 shrink-0 p-0`}
        >
          <IconoMas className="h-5 w-5" />
        </button>
      </div>

      {meta && meta.empresas.length > 1 && (
        <label className={`${labelBase} mt-5 sm:max-w-xs`}>
          Empresa
          <select
            value={empresaId}
            onChange={(e) => {
              setEmpresaId(Number(e.target.value));
              setPage(1);
            }}
            className={inputBase}
          >
            {meta.empresas.map((empresa) => (
              <option key={empresa.id} value={empresa.id}>
                {empresa.nombre}
              </option>
            ))}
          </select>
        </label>
      )}

      {error && !editando && <p className={`${errorBox} mt-4`}>{error}</p>}

      <ListaUsuariosMovil
        usuarios={usuarios}
        onEditar={abrirEditar}
        onLocales={setLocalesUsuario}
        onEliminar={soloSuperadmin ? setEliminando : undefined}
      />
      <div className="mt-5 hidden overflow-x-auto rounded-xl border border-line bg-surface-raised md:block">
        <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
          <thead className="bg-surface-soft text-left text-xs font-semibold uppercase text-foreground">
            <tr>
              <th className="px-4 py-3">Usuario</th>
              <th className="px-4 py-3">Rol</th>
              <th className="px-4 py-3">Superior</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line bg-surface-raised">
            {usuarios.map((usuario) => (
              <tr key={usuario.id}>
                <td className="px-4 py-3">
                  <p className="font-medium">
                    {usuario.nombre} {usuario.apellido}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {usuario.correo}
                  </p>
                </td>
                <td className="px-4 py-3">
                  {usuario.esSuperadmin
                    ? "Superadmin"
                    : (usuario.rol?.descripcion ?? "Sin rol")}
                </td>
                <td className="px-4 py-3">
                  {usuario.superior?.nombre ?? "Sin superior"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={
                      usuario.isActive
                        ? "text-emerald-700 dark:text-emerald-400"
                        : "text-red-700 dark:text-red-400"
                    }
                  >
                    {usuario.isActive ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {usuario.esSuperadmin ? (
                    <span className="text-xs font-medium text-muted">
                      Cuenta protegida
                    </span>
                  ) : (
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setLocalesUsuario(usuario)}
                        className={btnGhost}
                      >
                        Locales
                      </button>
                      <button
                        type="button"
                        onClick={() => abrirEditar(usuario)}
                        className={btnGhost}
                      >
                        Editar
                      </button>
                      {soloSuperadmin ? (
                        <button
                          type="button"
                          onClick={() => setEliminando(usuario)}
                          className="inline-flex min-h-11 items-center justify-center rounded-lg px-3 text-sm font-semibold text-red-700 transition hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-600/40 dark:text-red-300 dark:hover:bg-red-950"
                        >
                          Desactivar
                        </button>
                      ) : null}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {datos && datos.total > 0 && (
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
      )}

      <Modal
        titulo={editando === "nuevo" ? "Nuevo usuario" : "Editar usuario"}
        abierto={editando !== null}
        onCerrar={() => setEditando(null)}
      >
        <form onSubmit={guardar} className="flex flex-col gap-4">
          {editando === "nuevo" && (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Campo
                  label="Nombre"
                  value={form.nombre}
                  onChange={(nombre) => setForm((f) => ({ ...f, nombre }))}
                />
                <Campo
                  label="Apellido"
                  value={form.apellido}
                  onChange={(apellido) => setForm((f) => ({ ...f, apellido }))}
                />
              </div>
              <Campo
                label="Correo"
                type="email"
                value={form.correo}
                onChange={(correo) => setForm((f) => ({ ...f, correo }))}
              />
              <Campo
                label="Nombre de usuario"
                value={form.nombreLogin}
                onChange={(nombreLogin) =>
                  setForm((f) => ({ ...f, nombreLogin }))
                }
              />
              <div>
                <div className="grid grid-cols-[minmax(0,1fr)_5rem] gap-3">
                  <label className={labelBase}>
                    RUC (sin dígito verificador)
                    <input
                      value={form.ruc}
                      onChange={(e) => {
                        const base = e.target.value.trim().split("-")[0];
                        if (/^\d{0,8}$/.test(base)) {
                          setForm((f) => ({ ...f, ruc: base }));
                        }
                      }}
                      inputMode="numeric"
                      pattern="[0-9]{3,8}"
                      minLength={3}
                      required
                      aria-describedby="ruc-calculado"
                      className={inputBase}
                    />
                  </label>
                  <label className={labelBase}>
                    DV
                    <input
                      value={form.ruc.length >= 3 ? calcularDvRucPy(form.ruc) : ""}
                      readOnly
                      aria-label="Dígito verificador calculado"
                      className={`${inputBase} text-center`}
                    />
                  </label>
                </div>
                <p id="ruc-calculado" className="mt-2 text-xs text-muted" aria-live="polite">
                  {form.ruc.length >= 3
                    ? `RUC completo: ${form.ruc}-${calcularDvRucPy(form.ruc)}`
                    : "Ingresá de 3 a 8 números; el dígito verificador se calcula automáticamente."}
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className={labelBase}>
                  País del celular
                  <select
                    value={form.celularPais}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        celularPais: e.target.value as CountryCode,
                      }))
                    }
                    className={inputBase}
                  >
                    <option value="PY">Paraguay (+595)</option>
                    <option value="AR">Argentina (+54)</option>
                    <option value="BR">Brasil (+55)</option>
                    <option value="UY">Uruguay (+598)</option>
                    <option value="BO">Bolivia (+591)</option>
                  </select>
                </label>
                <Campo
                  label="Celular"
                  type="tel"
                  value={form.celular}
                  onChange={(celular) => setForm((f) => ({ ...f, celular }))}
                />
              </div>
            </>
          )}

          {editando && empresaId !== "" ? (
            <SelectorPaginado
              key={`${empresaId}-${editando === "nuevo" ? "nuevo" : editando.id}`}
              url={`${base}/roles?empresaId=${empresaId}`}
              etiqueta="Rol"
              value={form.rolId}
              required
              vacio="Seleccioná un rol de la empresa"
              seleccionActual={
                editando !== "nuevo" ? editando.rol?.descripcion : undefined
              }
              onChange={(rolId) => setForm((actual) => ({ ...actual, rolId }))}
            />
          ) : null}
          <label className={labelBase}>
            Superior
            <select
              value={form.superiorId}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  superiorId:
                    e.target.value === "" ? "" : Number(e.target.value),
                }))
              }
              className={inputBase}
            >
              <option value="">Sin superior</option>
              {superiores.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre} {u.apellido}
                </option>
              ))}
            </select>
          </label>
          {editando === "nuevo" && meta?.esSuperadmin ? (
            <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-line bg-surface-soft px-3 py-2.5 text-sm">
              <input
                type="checkbox"
                checked={form.esSuperadmin}
                onChange={(e) =>
                  setForm((f) => ({ ...f, esSuperadmin: e.target.checked }))
                }
                className="mt-0.5 h-4 w-4 accent-brand-700"
              />
              <span>
                <strong className="block text-foreground">
                  Otorgar acceso de superadmin
                </strong>
                <span className="mt-0.5 block text-xs text-muted">
                  Podrá administrar todas las empresas, usuarios y accesos.
                </span>
              </span>
            </label>
          ) : null}
          <Campo
            label={
              editando === "nuevo"
                ? "Contraseña"
                : "Nueva contraseña (opcional)"
            }
            type="password"
            value={form.password}
            required={editando === "nuevo"}
            onChange={(password) => setForm((f) => ({ ...f, password }))}
          />
          {editando !== "nuevo" && (
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) =>
                  setForm((f) => ({ ...f, isActive: e.target.checked }))
                }
              />
              Usuario activo
            </label>
          )}
          {error && <p className={errorBox}>{error}</p>}
          <div className="flex justify-end gap-2">
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

      {localesUsuario ? (
        <AsignacionesUsuario
          base={base}
          usuario={localesUsuario}
          onCerrar={() => setLocalesUsuario(null)}
        />
      ) : null}

      <Modal
        titulo="Desactivar usuario"
        abierto={eliminando !== null}
        onCerrar={() => setEliminando(null)}
      >
        <p className="text-sm text-muted">
          {eliminando ? (
            <>
              {eliminando.nombre} {eliminando.apellido} ya no podrá iniciar
              sesión. Conservamos su historial operativo.
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
            onClick={() => void confirmarDesactivacion()}
            disabled={desactivando}
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-700 focus-visible:ring-2 focus-visible:ring-red-600/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {desactivando ? "Desactivando..." : "Desactivar usuario"}
          </button>
        </div>
      </Modal>
    </div>
  );
}

function Campo({
  label,
  value,
  onChange,
  type = "text",
  required = true,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className={labelBase}>
      {label}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        minLength={type === "password" ? 8 : undefined}
        className={inputBase}
      />
    </label>
  );
}

function AsignacionesUsuario({
  base,
  usuario,
  onCerrar,
}: {
  base: string;
  usuario: UsuarioAdmin;
  onCerrar: () => void;
}) {
  const [datos, setDatos] = useState<RespuestaPaginada<UsuarioLocalAsignacion> | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(7);
  const [localId, setLocalId] = useState<number | "">("");
  const [fechaDesde, setFechaDesde] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [fechaHasta, setFechaHasta] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(() => {
    setCargando(true);
    apiFetch<RespuestaPaginada<UsuarioLocalAsignacion>>(
      `${base}/${usuario.id}/asignaciones?page=${page}&limit=${limit}`,
    )
      .then((respuesta) => {
        setDatos(respuesta);
        setError(null);
      })
      .catch((problema) =>
        setError(
          problema instanceof ApiError
            ? problema.message
            : "No se pudieron cargar los locales asignados",
        ),
      )
      .finally(() => setCargando(false));
  }, [base, limit, page, usuario.id]);

  useEffect(() => {
    const timer = window.setTimeout(cargar, 0);
    return () => window.clearTimeout(timer);
  }, [cargar]);

  async function asignar(e: React.FormEvent) {
    e.preventDefault();
    if (localId === "") return;
    setGuardando(true);
    setError(null);
    try {
      await apiFetch(`${base}/${usuario.id}/asignaciones`, {
        method: "POST",
        body: JSON.stringify({
          localId,
          fechaDesde,
          fechaHasta: fechaHasta || null,
        }),
      });
      setLocalId("");
      setFechaHasta("");
      setPage(1);
      cargar();
    } catch (problema) {
      setError(
        problema instanceof ApiError
          ? problema.message
          : "No se pudo asignar el local",
      );
    } finally {
      setGuardando(false);
    }
  }

  async function quitar(asignacion: UsuarioLocalAsignacion) {
    if (!window.confirm(`¿Quitar ${asignacion.nombreLocal} de este usuario?`)) return;
    setGuardando(true);
    setError(null);
    try {
      await apiFetch(
        `${base}/${usuario.id}/asignaciones/${asignacion.id}`,
        { method: "DELETE" },
      );
      cargar();
    } catch (problema) {
      setError(
        problema instanceof ApiError
          ? problema.message
          : "No se pudo quitar el local",
      );
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal
      titulo={`Locales de ${usuario.nombre} ${usuario.apellido}`}
      abierto
      onCerrar={onCerrar}
      ancho="lg"
    >
      <p className="text-sm text-muted">
        Las tareas configuradas para estos locales aparecerán automáticamente en su agenda
        durante la vigencia de cada asignación.
      </p>
      <form onSubmit={asignar} className="mt-5 space-y-3 rounded-xl border border-line bg-surface-soft p-4">
        <SelectorPaginado
          key={`${base}-${usuario.id}`}
          url={`${base}/locales?empresaId=${usuario.empresa.id}`}
          buscable
          etiqueta="Local"
          value={localId}
          required
          onChange={setLocalId}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Campo
            label="Desde"
            type="date"
            value={fechaDesde}
            onChange={setFechaDesde}
          />
          <Campo
            label="Hasta (opcional)"
            type="date"
            required={false}
            value={fechaHasta}
            onChange={setFechaHasta}
          />
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={guardando}
            className={`${btnPrimary} min-h-11 whitespace-nowrap`}
          >
            {guardando ? "Guardando..." : "Asignar local"}
          </button>
        </div>
      </form>
      {error ? <p className={`${errorBox} mt-3`}>{error}</p> : null}
      {cargando ? (
        <p className="mt-5 text-sm text-muted">Cargando asignaciones...</p>
      ) : datos && datos.items.length > 0 ? (
        <>
          <ul className="mt-5 space-y-2 md:hidden" aria-label="Locales asignados">
            {datos.items.map((asignacion) => (
              <li key={asignacion.id} className="rounded-xl border border-line bg-surface-raised p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{asignacion.nombreLocal}</p>
                    <p className="truncate text-xs text-muted">{asignacion.nombreCliente}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void quitar(asignacion)}
                    disabled={guardando}
                    className="min-h-11 shrink-0 rounded-lg px-3 text-sm font-semibold text-red-700 transition hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-600/40 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-300 dark:hover:bg-red-950"
                  >
                    Quitar
                  </button>
                </div>
                <p className="mt-2 text-xs text-muted">
                  Vigencia: {asignacion.fechaDesde.slice(0, 10)} · {asignacion.fechaHasta?.slice(0, 10) ?? "sin fecha de fin"}
                </p>
              </li>
            ))}
          </ul>
          <div className="mt-5 hidden overflow-x-auto rounded-xl border border-line md:block">
            <table className="min-w-full divide-y divide-line text-sm">
              <thead className="bg-surface-soft text-left text-xs font-semibold uppercase">
                <tr>
                  <th className="px-4 py-3">Local</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Vigencia</th>
                  <th className="px-4 py-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line bg-surface-raised">
                {datos.items.map((asignacion) => (
                  <tr key={asignacion.id}>
                    <td className="px-4 py-3 font-medium">{asignacion.nombreLocal}</td>
                    <td className="px-4 py-3">{asignacion.nombreCliente}</td>
                    <td className="px-4 py-3 text-muted">
                      {asignacion.fechaDesde.slice(0, 10)} · {asignacion.fechaHasta?.slice(0, 10) ?? "Sin fin"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => void quitar(asignacion)}
                        disabled={guardando}
                        className="min-h-11 rounded-lg px-3 text-sm font-semibold text-red-700 transition hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-600/40 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-300 dark:hover:bg-red-950"
                      >
                        Quitar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {datos.total > 0 ? (
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
        </>
      ) : (
        <p className="mt-5 rounded-xl border border-dashed border-line p-5 text-center text-sm text-muted">
          Todavía no tiene locales asignados.
        </p>
      )}
      <PantallaCarga visible={guardando} mensaje="Actualizando asignaciones" />
    </Modal>
  );
}
