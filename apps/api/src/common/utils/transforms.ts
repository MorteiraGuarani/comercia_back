import type { TransformFnParams } from 'class-transformer';

// Helpers de @Transform tipados (evitan el `any` de los arrows inline)
export function trimString({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : (value as unknown);
}

export function lowerTrimString({ value }: TransformFnParams): unknown {
  return typeof value === 'string'
    ? value.trim().toLowerCase()
    : (value as unknown);
}

/**
 * Recorta textos y toma "" (exportes de SAP o Excel) como dato vacío, no como
 * error: NULL, o undefined para que la columna sin NULL use su default.
 */
export function vacioComo(vacio: null | undefined) {
  return ({ value }: TransformFnParams): unknown =>
    typeof value === 'string' ? value.trim() || vacio : (value as unknown);
}
