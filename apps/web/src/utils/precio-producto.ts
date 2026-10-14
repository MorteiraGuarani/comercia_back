export function normalizarPrecio(texto: string): string {
  return texto
    .trim()
    .replace(",", ".")
    .replace(/^0+(?=\d)/, "");
}

// Quita los ceros decimales sobrantes de un precio de la API ("12.500000" → "12.5").
export function recortarPrecio(texto: string): string {
  return texto.includes(".") ? texto.replace(/\.?0+$/, "") : texto;
}

// Formato es-PY (miles con punto, decimales con coma) trabajando sobre el
// texto: pasar por Number pierde precisión con 15 enteros y 6 decimales.
export function formatearPrecio(texto: string): string {
  const [entero, decimales] = recortarPrecio(texto).split(".");
  const miles = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return decimales ? `${miles},${decimales}` : miles;
}
