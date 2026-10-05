export interface DatosVersionTarea {
  nombre: string;
  descripcion?: string;
  requiereFotos: boolean;
  fotosObligatorias: boolean;
  categoria?: string;
  esObligatoria?: boolean;
  version?: number;
}
