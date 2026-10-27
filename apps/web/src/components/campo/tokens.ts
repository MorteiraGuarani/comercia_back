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

/** Botón "+" de alta del módulo: en modo oscuro va rojo oscuro, no rosado. */
export const btnMasCampo =
  "grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-lg bg-[#8B2635] text-white transition-colors hover:bg-[#741f2c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus dark:bg-red-800 dark:hover:bg-red-700";
