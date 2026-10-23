export const PAGINA_UBICACIONES = 'ubicaciones';

/** Cada cuánto manda su posición el navegador mientras la jornada está activa. */
export const INTERVALO_PING_SEGUNDOS = 60;
/** Después de cada salida se sigue registrando el traslado al próximo local. */
export const MARGEN_TRASLADO_MS = 60 * 60_000;
/** Lo encolado sin señal que supere esta antigüedad se descarta. */
export const ANTIGUEDAD_MAXIMA_PING_MS = 48 * 60 * 60_000;
/** Tolerancia para el reloj del equipo adelantado. */
export const ADELANTO_MAXIMO_PING_MS = 2 * 60_000;
export const MAX_PINGS_POR_LOTE = 50;
export const RETENCION_UBICACIONES_DIAS = 90;

// El mapa en vivo y el recorrido se entregan completos (un mapa no se pagina);
// con tope y 413 en vez de truncar, como el organigrama.
export const LIMITE_PERSONAS_EN_VIVO = 2000;
export const LIMITE_PUNTOS_RECORRIDO = 5000;
