/**
 * TeamLeader y Supervisor (de impulsadores o de repositores). Siguen a su
 * equipo: ven Inicio, Presentismo y los locales, sin administrar el catálogo.
 * Misma regla que `esRolLiderCampo` de la API.
 */
export function esRolLiderCampo(descripcion?: string | null): boolean {
  const rol = (descripcion ?? "")
    .normalize("NFD")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  return rol.startsWith("teamleader") || rol.startsWith("supervisor");
}

// Páginas de Gestión de campo para los líderes, en el orden del menú.
// Novedades y avisos se abren desde la campana, no desde el menú.
const PAGINAS_LIDER_CAMPO = ["visitas", "locales", "novedades", "avisos"];

/** Si un líder de campo puede abrir esta página (otros módulos no cambian). */
export function paginaPermitidaLider(moduloRuta: string, paginaRuta: string): boolean {
  return moduloRuta !== "gestion-campo" || PAGINAS_LIDER_CAMPO.includes(paginaRuta);
}

/** Orden en el menú de las páginas de un líder: Presentismo antes que Locales. */
export function ordenPaginaLider(moduloRuta: string, paginaRuta: string): number {
  if (moduloRuta !== "gestion-campo") return PAGINAS_LIDER_CAMPO.length;
  const indice = PAGINAS_LIDER_CAMPO.indexOf(paginaRuta);
  return indice === -1 ? PAGINAS_LIDER_CAMPO.length : indice;
}
