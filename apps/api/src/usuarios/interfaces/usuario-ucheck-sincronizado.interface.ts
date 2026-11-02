/** Respuesta de Ucheck a PUT /comercia-integracion/usuarios. */
export interface UsuarioUcheckSincronizado {
  ucheckUsuarioId: number;
  creado: boolean;
  correo: string;
  activo: boolean;
  empresa: string;
  programas: string[];
}
