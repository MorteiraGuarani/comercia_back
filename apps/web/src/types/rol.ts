export interface EquipoCampo {
  id: number;
  nombre: string;
  tipo: "IMPULSADOR" | "REPOSITOR";
  activo: boolean;
}

export interface RolAdmin {
  empresa: { id: number; nombre: string };
  id: number;
  descripcion: string;
  padre: { id: number; descripcion: string } | null;
  usuariosCount: number;
  hijosCount: number;
  equipoCampo: EquipoCampo | null;
}

export interface FormRol {
  empresaId: number | "";
  descripcion: string;
  rolId: number | "";
  equipoCampoId: number | "";
  modoEquipo: "ninguno" | "existente" | "nuevo";
  nuevoEquipoNombre: string;
  nuevoEquipoTipo: "IMPULSADOR" | "REPOSITOR";
}
