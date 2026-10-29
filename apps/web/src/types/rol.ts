export interface EquipoCampo {
  id: number;
  nombre: string;
  tipo: "IMPULSADOR" | "REPOSITOR";
  activo: boolean;
}
export type AccionTareaCampo = "CONSULTAR" | "CREAR" | "EDITAR" | "ARCHIVAR";

export interface RolAdmin {
  empresa: { id: number; nombre: string };
  id: number;
  descripcion: string;
  padre: { id: number; descripcion: string } | null;
  usuariosCount: number;
  hijosCount: number;
  equipoCampo: EquipoCampo | null;
  permisosTareas: AccionTareaCampo[];
  puedeVerSeguimiento: boolean;
  /** Jefaturas: supervisa todos los equipos de la empresa. */
  gestionaTodosEquipos: boolean;
  /** Jefaturas: equipos que supervisa (vacío si es de un equipo). */
  equiposGestion: EquipoCampo[];
}

export interface FormRol {
  empresaId: number | "";
  descripcion: string;
  rolId: number | "";
  equipoCampoId: number | "";
  modoEquipo: "ninguno" | "existente" | "nuevo" | "varios";
  nuevoEquipoNombre: string;
  nuevoEquipoTipo: "IMPULSADOR" | "REPOSITOR";
  permisosTareas: AccionTareaCampo[];
  puedeVerSeguimiento: boolean;
  equiposGestionIds: number[];
  gestionaTodosEquipos: boolean;
}
