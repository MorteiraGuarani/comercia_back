// Datos de la ilustración del frente de un local cuando no hay imagen cargada.

// Tonos apagados: la ilustración acompaña, no compite con los estados de la tarjeta.
const COLORES_CARTEL = [
  "#5f7a5c",
  "#5a7090",
  "#97605b",
  "#86695a",
  "#9e8460",
  "#6f6886",
  "#5b7d76",
  "#8a6573",
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
