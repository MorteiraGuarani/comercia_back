import { diasParaVencer } from '../../common/utils/vencimiento';

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
