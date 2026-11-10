export const ESTADOS_CARGA = ['VIGENTE', 'POR_VENCER', 'VENCIDO'] as const;
export type EstadoCarga = (typeof ESTADOS_CARGA)[number];

/** Mismo plazo que los avisos de vencimiento: los días de aviso de la empresa. */
export function estadoCarga(dias: number, diasAviso: number): EstadoCarga {
  if (dias < 0) return 'VENCIDO';
  return dias <= diasAviso ? 'POR_VENCER' : 'VIGENTE';
}
