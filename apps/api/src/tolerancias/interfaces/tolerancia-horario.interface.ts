export interface ToleranciaHorario {
  anticipoEntrada: number;
  toleranciaEntrada: number;
  limiteEntrada: number;
  toleranciaSalidaAntes: number;
  toleranciaSalidaDespues: number;
  limiteSalida: number;
}
export type ValoresTolerancia = Partial<
  Record<keyof ToleranciaHorario, number | null>
>;
export type AlcanceTolerancia = 'global' | 'empresa' | 'horario' | 'usuario';
export type ColorHorario = 'VERDE' | 'AMARILLO' | 'ROJO';
