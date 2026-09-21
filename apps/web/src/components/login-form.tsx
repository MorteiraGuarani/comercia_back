"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PantallaCarga } from "@/components/pantalla-carga";
import { inputBase, labelBase } from "@/components/ui";
import { apiFetch, ApiError } from "@/lib/api";
import type { UsuarioSesion } from "@/types/usuario";
import type { ModuloMenu } from "@/types/plataforma";
import { rutaInicialImpulsador } from "@/utils/nombres-menu";

export function LoginForm() {
  const router = useRouter();
  const [identificador, setIdentificador] = useState("");
  const [password, setPassword] = useState("");
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;

    setError(null);
    setEnviando(true);
    try {
      await apiFetch<{ usuario: UsuarioSesion }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ identificador: identificador.trim(), password }),
      });
      const menu = await apiFetch<{ modulos: ModuloMenu[] }>("/mi-plataforma").catch(
        () => ({ modulos: [] as ModuloMenu[] }),
      );
      router.push(rutaInicialImpulsador(menu.modulos) ?? "/panel");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error inesperado");
      setEnviando(false);
    }
  }

  return (
    <>
      <div>
        <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#efb37f] lg:hidden">
          Acceso seguro
        </p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-[-0.035em] text-white sm:text-[1.75rem] lg:mt-0 lg:text-[1.45rem]">
          Bienvenido de nuevo
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-[#b9c9c3]">
          Ingresá para organizar tu jornada comercial.
        </p>
      </div>

      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4.5">
        <label className={labelBase}>
          Correo o nombre de usuario
          <input
            type="text"
            value={identificador}
            onChange={(e) => setIdentificador(e.target.value)}
            placeholder="tu@correo.com o tu.usuario"
            required
            autoComplete="username"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "login-error" : undefined}
            className={inputBase}
          />
        </label>

        <label className={labelBase}>
          Contraseña
          <span className="relative block">
            <input
              type={mostrarPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "login-error" : undefined}
              className={`${inputBase} pr-12`}
            />
            <button
              type="button"
              onClick={() => setMostrarPassword((actual) => !actual)}
              aria-label={mostrarPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              aria-pressed={mostrarPassword}
              className="absolute inset-y-1 right-1 grid w-10 place-items-center rounded-lg text-[#b9c9c3] transition hover:bg-[#28483d] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#efb37f]"
            >
              {mostrarPassword ? <IconoOcultar /> : <IconoMostrar />}
            </button>
          </span>
        </label>

        {error && (
          <p
            id="login-error"
            role="alert"
            className="rounded-xl border border-[#a95d54] bg-[#4b2522] px-3.5 py-3 text-sm text-[#ffd8d2]"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={enviando}
          className="group mt-1 inline-flex min-h-12 items-center justify-center rounded-xl border border-[#efb37f] bg-[#d9955d] px-4 py-2.5 text-sm font-extrabold text-[#10231d] transition hover:-translate-y-0.5 hover:bg-[#e5aa78] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#10231d] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0"
        >
          <span>{enviando ? "Ingresando..." : "Ingresar"}</span>
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5"
            aria-hidden
          >
            <path d="M3 10a.75.75 0 01.75-.75h10.69l-3.22-3.22a.75.75 0 111.06-1.06l4.5 4.5a.75.75 0 010 1.06l-4.5 4.5a.75.75 0 11-1.06-1.06l3.22-3.22H3.75A.75.75 0 013 10z" />
          </svg>
        </button>
      </form>

      <p className="mt-6 border-t border-[#405a50] pt-5 text-center text-xs leading-relaxed text-[#aebeb8] lg:text-left">
        Si necesitás ayuda para acceder, contactá al administrador de tu empresa.
      </p>

      <PantallaCarga
        visible={enviando}
        mensaje="Ingresando a Comercia"
        detalle="Estamos preparando tu espacio de trabajo."
      />
    </>
  );
}

function IconoMostrar() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden>
      <path d="M10 3c-4.17 0-7.55 2.55-8.8 6.18a2.5 2.5 0 000 1.64C2.45 14.45 5.83 17 10 17s7.55-2.55 8.8-6.18a2.5 2.5 0 000-1.64C17.55 5.55 14.17 3 10 3zm0 11a4 4 0 110-8 4 4 0 010 8zm0-1.75a2.25 2.25 0 100-4.5 2.25 2.25 0 000 4.5z" />
    </svg>
  );
}

function IconoOcultar() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden>
      <path fillRule="evenodd" d="M2.72 1.66a.75.75 0 00-1.06 1.06l15.62 15.62a.75.75 0 101.06-1.06l-2.04-2.04c1.15-1.07 2.02-2.41 2.5-3.81a2.5 2.5 0 000-1.64C17.55 6.15 14.17 3.6 10 3.6c-1.2 0-2.33.21-3.37.59L2.72 1.66zM8.2 5.76c.57-.16 1.17-.24 1.8-.24a4 4 0 014 4c0 .63-.08 1.23-.24 1.8L8.2 5.76zM4.65 6.1C3.08 7.15 1.9 8.68 1.2 10.72a2.5 2.5 0 000 1.64C2.45 15.99 5.83 18.54 10 18.54c1.05 0 2.06-.16 3-.46l-2.18-2.18A4 4 0 014.1 9.18L4.65 6.1z" clipRule="evenodd" />
    </svg>
  );
}
