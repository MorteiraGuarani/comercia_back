export type AlcanceTolerancia = 'global' | 'empresa' | 'horario' | 'usuario';
export interface ValoresTolerancia {
  anticipoEntrada: number;
  toleranciaEntrada: number;
  limiteEntrada: number;
  toleranciaSalidaAntes: number;
  toleranciaSalidaDespues: number;
  limiteSalida: number;
}
export interface ConfiguracionTolerancia {
  alcance: AlcanceTolerancia; id: number;
  valores: Partial<Record<keyof ValoresTolerancia, number | null>>;
  heredados: ValoresTolerancia; efectivos: ValoresTolerancia;
}
