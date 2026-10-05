export interface IdentidadUcheckAdmin {
  id: number;
  nombre: string;
  correo: string;
  activa: boolean;
  empresa: string | null;
  programas: string[];
}
export interface VinculoUcheckAdmin {
  usuarioId: number;
  correo: string;
  vinculo: {
    ucheckUsuarioId: number;
    correoVinculado: string;
    updatedAt: string;
  } | null;
  candidata: IdentidadUcheckAdmin | null;
  error: string | null;
}
