import type { ReactNode } from 'react';
const COLORES: Record<string, { clase: string; texto: string }> = {
  VERDE: { clase: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200', texto: 'Verde' },
  AMARILLO: { clase: 'bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200', texto: 'Amarillo' },
  ROJO: { clase: 'bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200', texto: 'Rojo' },
};
export function ColorHorario({ color, children }: { color?: string | null; children?: ReactNode }) {
  const c = color ? COLORES[color] : null;
  return c ? <span className={'inline-flex gap-1 rounded px-2 py-1 text-xs font-medium ' + c.clase}>{children}{c.texto}</span> : null;
}
