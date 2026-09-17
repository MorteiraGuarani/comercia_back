/**
 * Sistema de diseño visual editorial para el módulo comercial de Comercia
 * Basado en la maqueta de referencia de supervisión comercial.
 */
export const TOKENS = {
  // Los valores son variables para que el mismo módulo respete .dark sin
  // duplicar estilos en cada pantalla.
  carne: "var(--campo-carne, #8B2635)",
  frio: "var(--campo-frio, #2C4A6E)",
  fresco: "var(--campo-fresco, #4F7A52)",
  alerta: "var(--campo-alerta, #C1752B)",
  critico: "var(--campo-critico, #A32F2F)",
  plum: "var(--campo-plum, #5B4B7A)",
  ink: "var(--campo-ink, #1E2320)",
  bone: "var(--campo-bone, #ECE9E2)",
  canvas: "var(--campo-canvas, #F8F7F4)",
  line: "var(--campo-line, #DAD5C9)",
  sub: "var(--campo-sub, #726C60)",
  strong: "var(--commercial-ink)",
} as const;

export type TokenColor = keyof typeof TOKENS;
