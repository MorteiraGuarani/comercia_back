export interface RegistroSocio {
  id: bigint;
  [campo: string]: unknown;
}

export type EntradaSocio = Record<string, unknown>;
