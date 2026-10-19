const DIA_MS = 24 * 60 * 60 * 1000;

/** Fotos creadas antes de esta fecha superan la retención; null = apagada. */
export function limiteRetencionFotos(ahora: Date, dias: number): Date | null {
  if (!Number.isInteger(dias) || dias <= 0) return null;
  return new Date(ahora.getTime() - dias * DIA_MS);
}
