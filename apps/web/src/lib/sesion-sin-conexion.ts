// Último usuario y menú del panel en este equipo (localStorage): sin señal el
// panel abre con ellos en vez de mandar al login, para seguir trabajando con lo
// guardado. No hay credenciales: la API sigue exigiendo la cookie. Se borra al salir.
import type { UsuarioSesion } from "@/types/usuario";
import type { ModuloMenu } from "@/types/plataforma";

const CLAVE = "comercia:sesion-sin-conexion";

interface SesionGuardada {
  usuario: UsuarioSesion;
  modulos: ModuloMenu[];
}

export function guardarSesionSinConexion(sesion: SesionGuardada): void {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(sesion));
  } catch {
    // Almacenamiento bloqueado: sin señal se pedirá ingresar.
  }
}

export function leerSesionSinConexion(): SesionGuardada | null {
  try {
    const texto = localStorage.getItem(CLAVE);
    return texto ? (JSON.parse(texto) as SesionGuardada) : null;
  } catch {
    return null;
  }
}

export function borrarSesionSinConexion(): void {
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    // Almacenamiento bloqueado: no hay nada guardado.
  }
}
