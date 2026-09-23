/** Escapa texto de la API antes de insertarlo en el HTML de Leaflet. */
export function escaparHtml(valor: string): string {
  const entidades: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return valor.replace(/[&<>"']/g, (caracter) => entidades[caracter]);
}
