export const PAGINA_UBICACIONES = 'ubicaciones';

/**
 * Un punto cada 30 s: el navegador lo manda a ese ritmo. Los pings se guardan
 * en Ucheck (uno por intervalo, con retención de 90 días).
 */
export const INTERVALO_PING_SEGUNDOS = 30;
/** Después de cada salida se sigue registrando el traslado al próximo local. */
export const MARGEN_TRASLADO_MS = 60 * 60_000;
/** Lo encolado sin señal que supere esta antigüedad se descarta. */
export const ANTIGUEDAD_MAXIMA_PING_MS = 48 * 60 * 60_000;
/** Tolerancia para el reloj del equipo adelantado. */
export const ADELANTO_MAXIMO_PING_MS = 2 * 60_000;
export const MAX_PINGS_POR_LOTE = 50;

// El mapa en vivo se entrega completo (un mapa no se pagina); con tope y 413
// en vez de truncar, como el organigrama. El recorrido lo limita Ucheck.
export const LIMITE_PERSONAS_EN_VIVO = 2000;
