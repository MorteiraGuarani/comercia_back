/** Días enteros entre hoy y el vencimiento (YYYY-MM-DD); negativo si ya venció. */
export function diasParaVencer(
  vencimiento: Date | string,
  hoy: string,
): number {
  const fecha =
    typeof vencimiento === 'string'
      ? vencimiento
      : vencimiento.toISOString().slice(0, 10);
  return Math.round(
    (Date.parse(`${fecha}T00:00:00Z`) - Date.parse(`${hoy}T00:00:00Z`)) /
      86_400_000,
  );
}
