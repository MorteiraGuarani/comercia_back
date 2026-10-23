/** Fila de un lote ya validada, o el motivo por el que no pasó la validación. */
export type FilaLoteUsuarios<T> = { dto: T } | { error: string };

export interface FilasLoteUsuarios<T> {
  /** false: llegó un objeto solo (responde como siempre, sin resumen). */
  lote: boolean;
  filas: FilaLoteUsuarios<T>[];
}

export interface ErrorLoteUsuario {
  /** Posición de la fila en el arreglo enviado, desde 0. */
  indice: number;
  id?: number;
  usuario?: string;
  error: string;
}

/** Resumen de un lote: lo que salió bien y, al final, lo que no y por qué. */
export interface ResultadoLoteUsuarios<T> {
  total: number;
  exitosos: number;
  fallidos: number;
  resultados: T[];
  errores: ErrorLoteUsuario[];
}
