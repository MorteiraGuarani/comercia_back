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

function fechaLegible(fecha: Date) {
  const [anio, mes, dia] = fecha.toISOString().slice(0, 10).split('-');
  return `${dia}/${mes}/${anio}`;
}

/** Título y mensaje del aviso, dentro de los largos de campo_notificaciones. */
export function textoAvisoVencimiento(
  producto: string,
  local: string,
  vencimiento: Date,
  cantidad: number,
  hoy: string,
) {
  const dias = diasParaVencer(vencimiento, hoy);
  const cuando =
    dias < 0
      ? 'Vencido'
      : dias === 0
        ? 'Vence hoy'
        : dias === 1
          ? 'Vence mañana'
          : `Vence en ${dias} días`;
  return {
    titulo: `${cuando}: ${producto}`.slice(0, 100),
    mensaje:
      `${producto} en ${local} ${dias < 0 ? 'venció' : 'vence'} el ${fechaLegible(vencimiento)}. Cantidad cargada: ${cantidad}.`.slice(
        0,
        250,
      ),
  };
}
