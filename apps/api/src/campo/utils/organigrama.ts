import type {
  AlertaOrganigrama,
  PersonaJerarquia,
} from '../interfaces/organigrama.interface';

/**
 * Alertas de jerarquía por persona activa. raizId marca una vista parcial (el
 * equipo de un líder): ahí el superior de la raíz queda fuera a propósito.
 */
export function alertasOrganigrama(
  personas: PersonaJerarquia[],
  raizId: number | null,
): Map<number, AlertaOrganigrama[]> {
  const porId = new Map(personas.map((p) => [p.id, p]));
  const conACargo = new Set(
    personas
      .filter((p) => p.activo && p.superiorId !== null)
      .map((p) => p.superiorId),
  );
  const alertas = new Map<number, AlertaOrganigrama[]>();
  for (const p of personas) {
    const lista: AlertaOrganigrama[] = [];
    if (p.activo) {
      if (!p.tieneRol) lista.push('SIN_ROL');
      // Las jefaturas supervisan varios equipos sin pertenecer a uno.
      else if (p.equipoId === null && !p.gestor) lista.push('SIN_EQUIPO');
      const superior =
        p.superiorId === null ? undefined : porId.get(p.superiorId);
      if (p.superiorId !== null && !superior && p.id !== raizId)
        lista.push('SUPERIOR_FUERA');
      if (superior && !superior.activo) lista.push('SUPERIOR_INACTIVO');
      if (
        superior &&
        p.equipoId !== null &&
        superior.equipoId !== null &&
        superior.equipoId !== p.equipoId
      )
        lista.push('OTRO_EQUIPO');
      if (
        raizId === null &&
        p.superiorId === null &&
        p.equipoId !== null &&
        !conACargo.has(p.id)
      )
        lista.push('AISLADO');
    }
    alertas.set(p.id, lista);
  }
  return alertas;
}
