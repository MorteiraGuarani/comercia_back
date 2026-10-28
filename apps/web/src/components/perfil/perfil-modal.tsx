"use client";

import { useRef, useState } from "react";
import type { CountryCode } from "libphonenumber-js";
import { Modal } from "@/components/modal";
import { PantallaCarga } from "@/components/pantalla-carga";
import { mostrarToast } from "@/components/toast/toast-controller";
import { confirmar } from "@/components/confirmacion/confirmacion-controller";
import { btnGhost, btnPrimary, inputBase, labelBase } from "@/components/ui";
import {
  actualizarPerfil,
  quitarFotoPerfil,
  subirFotoPerfil,
  urlFotoPerfil,
  type CambiosPerfil,
} from "@/lib/api-perfil";
import { mensajeError } from "@/utils/error";
import { prepararImagen } from "@/utils/preparar-imagen";
import { baseRuc, calcularDvRucPy } from "@/utils/ruc";
import { partesCelular } from "@/utils/telefono";
import type { UsuarioSesion } from "@/types/usuario";

const PAISES: { codigo: CountryCode; nombre: string }[] = [
  { codigo: "PY", nombre: "Paraguay (+595)" },
  { codigo: "AR", nombre: "Argentina (+54)" },
  { codigo: "BR", nombre: "Brasil (+55)" },
  { codigo: "UY", nombre: "Uruguay (+598)" },
  { codigo: "BO", nombre: "Bolivia (+591)" },
];

function formularioDe(u: UsuarioSesion) {
  const celular = partesCelular(u.celular);
  return {
    nombre: u.nombre,
    apellido: u.apellido,
    correo: u.correo,
    ruc: baseRuc(u.ruc),
    celularPais: celular.pais,
    celular: u.celular ? celular.numero : "",
  };
}

/**
 * "Mis Datos" para todos los roles: foto de perfil, y nombre, apellido,
 * correo, RUC y celular editables. Usuario, rol, empresa y legajo solo se ven:
 * los cambia un administrador.
 */
export function PerfilModal({
  usuario,
  onActualizado,
  onCerrar,
}: {
  usuario: UsuarioSesion;
  onActualizado: (usuario: UsuarioSesion) => void;
  onCerrar: () => void;
}) {
  const [form, setForm] = useState(() => formularioDe(usuario));
  const [operacion, setOperacion] = useState("");
  const [error, setError] = useState("");
  const archivoRef = useRef<HTMLInputElement>(null);
  const original = formularioDe(usuario);
  const cambioRuc = form.ruc !== original.ruc;
  const cambioCelular =
    form.celular.trim() !== original.celular || form.celularPais !== original.celularPais;
  const cambios: CambiosPerfil = {
    ...(form.nombre.trim() !== original.nombre ? { nombre: form.nombre.trim() } : {}),
    ...(form.apellido.trim() !== original.apellido ? { apellido: form.apellido.trim() } : {}),
    ...(form.correo.trim().toLowerCase() !== original.correo
      ? { correo: form.correo.trim().toLowerCase() }
      : {}),
    ...(cambioRuc && form.ruc ? { ruc: `${form.ruc}-${calcularDvRucPy(form.ruc)}` } : {}),
    ...(cambioCelular && form.celular.trim() ? { celular: form.celular.trim() } : {}),
    ...((cambioRuc && form.ruc) || (cambioCelular && form.celular.trim())
      ? { celularPais: form.celularPais }
      : {}),
  };
  const hayCambios = Object.keys(cambios).length > 0;
  const iniciales = `${usuario.nombre[0] ?? ""}${usuario.apellido[0] ?? ""}`.toUpperCase();

  async function ejecutar(mensaje: string, accion: () => Promise<UsuarioSesion>, exito: string) {
    setOperacion(mensaje);
    setError("");
    try {
      const actualizado = await accion();
      onActualizado(actualizado);
      mostrarToast("exito", exito);
      return actualizado;
    } catch (e) {
      setError(mensajeError(e, "No se pudo guardar el cambio."));
      return null;
    } finally {
      setOperacion("");
    }
  }

  async function guardar() {
    if (!hayCambios || operacion) return;
    const actualizado = await ejecutar(
      "Guardando tus datos",
      () => actualizarPerfil(cambios),
      "Tus datos quedaron guardados.",
    );
    if (actualizado) onCerrar();
  }

  async function cerrar() {
    if (
      hayCambios &&
      !(await confirmar({
        titulo: "Descartar cambios",
        mensaje: "Hay cambios sin guardar en tus datos. ¿Querés descartarlos?",
        textoConfirmar: "Descartar",
        peligro: true,
      }))
    )
      return;
    onCerrar();
  }

  return (
    <Modal titulo="Mis Datos" abierto onCerrar={() => void cerrar()} ancho="lg" hojaMovil>
      <PantallaCarga visible={!!operacion} mensaje={operacion} />
      <form
        className="min-w-0 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void guardar();
        }}
      >
        {/* Foto de perfil */}
        <div className="flex min-w-0 items-center gap-4">
          {usuario.fotoPerfilVersion ? (
            // La foto es privada: se sirve con la cookie de sesión.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={urlFotoPerfil(usuario.fotoPerfilVersion)}
              alt="Tu foto de perfil"
              className="h-20 w-20 shrink-0 rounded-full border border-line object-cover"
            />
          ) : (
            <span
              aria-hidden="true"
              className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-brand-100 text-2xl font-extrabold text-brand-900 dark:bg-brand-950 dark:text-brand-100"
            >
              {iniciales}
            </span>
          )}
          <div className="min-w-0 space-y-2">
            <p className="truncate text-sm font-semibold text-foreground">
              {usuario.nombre} {usuario.apellido}
            </p>
            <div className="flex flex-wrap gap-2">
              <input
                ref={archivoRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                tabIndex={-1}
                aria-label="Elegir foto de perfil"
                onChange={(e) => {
                  const archivo = e.target.files?.[0];
                  e.target.value = "";
                  if (archivo)
                    void ejecutar(
                      "Subiendo tu foto",
                      async () => subirFotoPerfil(await prepararImagen(archivo)),
                      "Foto de perfil actualizada.",
                    );
                }}
              />
              <button
                type="button"
                className={`${btnGhost} whitespace-nowrap`}
                disabled={!!operacion}
                onClick={() => archivoRef.current?.click()}
              >
                {usuario.fotoPerfilVersion ? "Cambiar foto" : "Subir foto"}
              </button>
              {usuario.fotoPerfilVersion ? (
                <button
                  type="button"
                  className="min-h-11 cursor-pointer whitespace-nowrap rounded-lg px-3 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-300 dark:hover:bg-red-950/50"
                  disabled={!!operacion}
                  onClick={() =>
                    void ejecutar("Quitando tu foto", quitarFotoPerfil, "Foto de perfil quitada.")
                  }
                >
                  Quitar
                </button>
              ) : null}
            </div>
            <p className="text-xs text-muted">JPG, PNG o WebP de hasta 5 MB.</p>
          </div>
        </div>

        {/* Datos editables */}
        <fieldset disabled={!!operacion} className="min-w-0 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className={labelBase}>
              Nombre
              <input
                value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                required
                minLength={2}
                maxLength={60}
                autoComplete="given-name"
                className={inputBase}
              />
            </label>
            <label className={labelBase}>
              Apellido
              <input
                value={form.apellido}
                onChange={(e) => setForm((f) => ({ ...f, apellido: e.target.value }))}
                required
                minLength={2}
                maxLength={60}
                autoComplete="family-name"
                className={inputBase}
              />
            </label>
          </div>
          <label className={labelBase}>
            Correo electrónico
            <input
              type="email"
              value={form.correo}
              onChange={(e) => setForm((f) => ({ ...f, correo: e.target.value }))}
              required
              maxLength={120}
              autoComplete="email"
              className={inputBase}
            />
          </label>
          <div className="grid grid-cols-[minmax(0,1fr)_4.5rem] gap-3">
            <label className={labelBase}>
              RUC
              <input
                inputMode="numeric"
                value={form.ruc}
                onChange={(e) =>
                  setForm((f) => ({ ...f, ruc: e.target.value.replace(/\D/g, "").slice(0, 8) }))
                }
                minLength={3}
                placeholder="Sin RUC"
                aria-describedby="perfil-ruc"
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
          <p id="perfil-ruc" className="-mt-1 text-xs text-muted" aria-live="polite">
            Ingresá de 3 a 8 números; el dígito verificador se calcula solo.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className={labelBase}>
              País del celular
              <select
                value={form.celularPais}
                onChange={(e) =>
                  setForm((f) => ({ ...f, celularPais: e.target.value as CountryCode }))
                }
                className={inputBase}
              >
                {PAISES.map((p) => (
                  <option key={p.codigo} value={p.codigo}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelBase}>
              Teléfono celular
              <input
                type="tel"
                value={form.celular}
                onChange={(e) => setForm((f) => ({ ...f, celular: e.target.value }))}
                autoComplete="tel"
                className={inputBase}
              />
            </label>
          </div>
        </fieldset>

        {/* Solo vista: los cambia un administrador */}
        <section
          aria-label="Datos que administra la empresa"
          className="rounded-xl border border-line bg-surface-soft p-3"
        >
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted">
            Solo lectura · los cambia un administrador
          </p>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-1.5 text-sm">
            <dt className="text-muted">Usuario</dt>
            <dd className="break-all text-foreground">{usuario.nombreLogin}</dd>
            <dt className="text-muted">Rol</dt>
            <dd className="text-foreground">
              {usuario.esSuperadmin
                ? "Superadmin"
                : (usuario.rol?.descripcion ?? "Pendiente de asignación")}
            </dd>
            <dt className="text-muted">Empresa</dt>
            <dd className="break-words text-foreground">{usuario.empresa.nombre}</dd>
            <dt className="text-muted">Legajo</dt>
            <dd className="text-foreground">{usuario.legajo ?? "—"}</dd>
            {usuario.rol?.equipoCampo ? (
              <>
                <dt className="text-muted">Equipo</dt>
                <dd className="text-foreground">{usuario.rol.equipoCampo.nombre}</dd>
              </>
            ) : null}
          </dl>
        </section>

        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
          >
            {error}
          </p>
        ) : null}

        <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
          <button type="button" className={btnGhost} onClick={() => void cerrar()}>
            Cancelar
          </button>
          <button type="submit" className={btnPrimary} disabled={!hayCambios || !!operacion}>
            Guardar cambios
          </button>
        </div>
      </form>
    </Modal>
  );
}
