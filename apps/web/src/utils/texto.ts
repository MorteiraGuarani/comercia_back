// Normaliza texto para búsquedas: minúsculas y sin acentos
// ("Perú" → "peru", así "peru" lo encuentra)
export function normalizarBusqueda(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/** Las `cantidad` opciones más parecidas: exacta, empieza igual, alguna palabra empieza igual, resto. */
export function opcionesMasCercanas<T>(
  opciones: T[],
  texto: (opcion: T) => string,
  buscado: string,
  cantidad: number,
): T[] {
  const q = normalizarBusqueda(buscado.trim());
  const distancia = (opcion: T) => {
    const t = normalizarBusqueda(texto(opcion));
    if (t === q) return 0;
    if (t.startsWith(q)) return 1;
    return ` ${t}`.includes(` ${q}`) ? 2 : 3;
  };
  return [...opciones]
    .sort((a, b) => distancia(a) - distancia(b))
    .slice(0, cantidad);
}
