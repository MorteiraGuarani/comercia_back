// Últimos datos de una pantalla, guardados en la pestaña (sessionStorage):
// al volver a entrar se muestran enseguida mientras se piden los nuevos. Se
// borran al cerrar la pestaña o la sesión. Si el navegador no deja guardar,
// la pantalla funciona igual, solo que sin ese atajo.
const PREFIJO = "comercia:cache:";

export function leerCacheSesion<T>(
  clave: string,
): { valor: T; guardado: number } | null {
  try {
    const texto = sessionStorage.getItem(PREFIJO + clave);
    return texto ? (JSON.parse(texto) as { valor: T; guardado: number }) : null;
  } catch {
    return null;
  }
}

export function guardarCacheSesion<T>(clave: string, valor: T): void {
  try {
    sessionStorage.setItem(
      PREFIJO + clave,
      JSON.stringify({ valor, guardado: Date.now() }),
    );
  } catch {
    // Sin espacio o almacenamiento bloqueado: no se guarda.
  }
}

export function borrarCacheSesion(): void {
  try {
    for (const clave of Object.keys(sessionStorage))
      if (clave.startsWith(PREFIJO)) sessionStorage.removeItem(clave);
  } catch {
    // Almacenamiento bloqueado: no hay nada que borrar.
  }
}
