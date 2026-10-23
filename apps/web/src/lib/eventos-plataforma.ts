export const EVENTO_PLATAFORMA_ACTUALIZADA =
  'comercia:plataforma-actualizada';

export function notificarPlataformaActualizada(): void {
  window.dispatchEvent(new Event(EVENTO_PLATAFORMA_ACTUALIZADA));
}

// Una entrada nueva puede activar el envío de la ubicación sin esperar el
// próximo chequeo del estado de la jornada.
export const EVENTO_JORNADA_MARCADA = 'comercia:jornada-marcada';

export function notificarJornadaMarcada(): void {
  window.dispatchEvent(new Event(EVENTO_JORNADA_MARCADA));
}
