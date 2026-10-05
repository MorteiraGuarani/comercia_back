export interface IdentidadUcheckAdmin {
  id: number;
  nombre: string;
  correo: string;
  activa: boolean;
  empresa: string | null;
  programas: string[];
}
