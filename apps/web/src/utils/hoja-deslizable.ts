/** Se decide al soltar: volver hacia arriba también cancela un arrastre largo. */
export function debeMinimizarHoja(desplazamiento: number, alto: number, velocidad: number): boolean {
  if (desplazamiento <= 0 || velocidad < -0.4) return false;
  return desplazamiento >= Math.min(160, alto * 0.35) || (desplazamiento >= 48 && velocidad > 0.6);
}
