export function normalizarPrecio(texto: string): string {
  return texto
    .trim()
    .replace(",", ".")
    .replace(/^0+(?=\d)/, "");
}
