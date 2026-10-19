// Datos de la ilustración del frente de un local cuando no hay imagen cargada.

const COLORES_CARTEL = [
  "#2f6b2a",
  "#1d4fa0",
  "#c4161c",
  "#8a3b1e",
  "#c96a0c",
  "#5a4a8a",
  "#0b6b5f",
  "#9b1c4a",
] as const;

/** Color estable del cartel: el mismo local siempre se dibuja igual. */
export function colorCartelLocal(nombre: string): string {
  let hash = 0;
  for (const letra of nombre) hash = (hash * 31 + letra.charCodeAt(0)) >>> 0;
  return COLORES_CARTEL[hash % COLORES_CARTEL.length];
}

/** Hasta dos iniciales para el avatar cuando no hay logo ("Biggie Mariscal" → "BM"). */
export function inicialesNombre(nombre: string): string {
  return (
    nombre
      .trim()
      .split(/\s+/)
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "CL"
  );
}

export function textoCartelLocal(nombre: string, maximo = 14): string {
  const limpio = nombre.trim();
  return limpio.length > maximo ? `${limpio.slice(0, maximo - 1)}…` : limpio;
}
