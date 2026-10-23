import { relojCampo } from '../../campo/utils/calendario';
import { MARGEN_TRASLADO_MS } from '../ubicaciones.constants';

/**
 * La jornada está activa desde cada entrada del día hasta su salida más el
 * margen de traslado al próximo local. Fuera de eso no se registra la posición.
 */
export function enJornada(
  momento: Date,
  visitas: { fecha: Date; entrada: Date; salida: Date | null }[],
): boolean {
  const dia = relojCampo(momento).fecha;
  const t = momento.getTime();
  return visitas.some(
    (v) =>
      v.fecha.toISOString().slice(0, 10) === dia &&
      v.entrada.getTime() <= t &&
      (v.salida === null || t <= v.salida.getTime() + MARGEN_TRASLADO_MS),
  );
}
