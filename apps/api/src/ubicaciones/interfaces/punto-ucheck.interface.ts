/** Ping tal como lo devuelve Ucheck (fuente de las ubicaciones). */
export interface PuntoUcheck {
  latitud: number;
  longitud: number;
  precisionMetros: number | null;
  velocidad: number | null;
  rumbo: number | null;
  /** ISO 8601 */
  capturadaEn: string;
}
