/** Respuesta de Ucheck a PUT /comercia-integracion/usuarios. */
export interface UsuarioUcheckSincronizado {
  ucheckUsuarioId: number;
  creado: boolean;
  correo: string;
  activo: boolean;
  empresa: string;
  /** Programas del catálogo de la empresa que la cuenta tiene ahora. */
  programas: string[];
}

/** Respuesta de Ucheck a GET /comercia-integracion/programas. */
export interface ProgramasUcheckPagina {
  programas: { codigo: string; nombre: string }[];
  paginacion: { total: number };
}
