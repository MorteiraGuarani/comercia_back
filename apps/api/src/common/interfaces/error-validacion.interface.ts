/** Un campo inválido: dónde está, qué llegó y por qué no se acepta. */
export interface ErrorCampo {
  campo: string;
  valor: unknown;
  mensajes: string[];
}

export interface FilaInvalida {
  /** Posición en el arreglo, desde cero. */
  index: number;
  /** Número de fila para personas, desde uno. */
  fila: number;
  errores: ErrorCampo[];
  /** El problema de la fila en una línea, para mostrar al usuario. */
  motivo: string;
  details: string | object;
}

/** Bulk validado: las filas válidas siguen y las inválidas se informan. */
export interface LoteValidado {
  filas: Record<string, unknown>[];
  /** Posición original de cada fila válida, para informar errores de la base. */
  indices: number[];
  invalidas: FilaInvalida[];
  recibidos: number;
}
