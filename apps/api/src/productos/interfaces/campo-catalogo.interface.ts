export interface CampoCatalogo {
  tipo: 'texto' | 'entero' | 'decimal';
  longitud?: number;
  small?: boolean;
  requerido?: boolean;
  nullable?: boolean;
  defecto?: string | number;
  descripcion: string;
  ejemplo: string | number;
}
