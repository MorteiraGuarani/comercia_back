import { API_URL, apiFetch } from "@/lib/api";
import type { UsuarioSesion } from "@/types/usuario";

/** Lo que cada usuario puede cambiar de sí mismo en "Mis Datos". */
export interface CambiosPerfil {
  nombre?: string;
  apellido?: string;
  correo?: string;
  ruc?: string;
  celular?: string;
  celularPais?: string;
}

export async function actualizarPerfil(cambios: CambiosPerfil): Promise<UsuarioSesion> {
  const r = await apiFetch<{ usuario: UsuarioSesion }>("/perfil", {
    method: "PATCH",
    body: JSON.stringify(cambios),
  });
  return r.usuario;
}

export async function subirFotoPerfil(foto: File): Promise<UsuarioSesion> {
  const cuerpo = new FormData();
  cuerpo.append("foto", foto);
  const r = await apiFetch<{ usuario: UsuarioSesion }>("/perfil/foto", {
    method: "POST",
    body: cuerpo,
  });
  return r.usuario;
}

export async function quitarFotoPerfil(): Promise<UsuarioSesion> {
  const r = await apiFetch<{ usuario: UsuarioSesion }>("/perfil/foto", { method: "DELETE" });
  return r.usuario;
}

/** La versión cambia con cada foto nueva: así el navegador no muestra una vieja. */
export function urlFotoPerfil(version: string): string {
  return `${API_URL}/perfil/foto?v=${encodeURIComponent(version)}`;
}
