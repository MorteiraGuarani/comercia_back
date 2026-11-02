/**
 * Programas de Ucheck que le corresponden a un rol de Comercia. Solo el equipo
 * de campo (rol con equipo operativo activo) tiene: repositores su programa,
 * supervisores y TeamLeaders el de supervisión y el resto el de impulsadores,
 * todos con SEGUIMIENTO. Misma regla que el vínculo manual con Ucheck.
 */
export function programasUcheck(
  rol: {
    descripcion: string;
    equipoCampo: { tipo: string; activo: boolean } | null;
  } | null,
): string[] {
  if (!rol?.equipoCampo?.activo) return [];
  const nombre = rol.descripcion.toLowerCase().replace(/[^a-z]/g, '');
  const campo =
    rol.equipoCampo.tipo === 'REPOSITOR'
      ? 'COMERCIA_REPOSITOR'
      : /^(supervisor|teamleader)/.test(nombre)
        ? 'COMERCIA_TEAMLEADER'
        : 'COMERCIA';
  return [campo, 'SEGUIMIENTO'];
}
