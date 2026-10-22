// GET /campo/organigrama: quién está a cargo de quién y qué pasa hoy.

export type AlertaOrganigrama =
  | "SIN_ROL"
  | "SIN_EQUIPO"
  | "SUPERIOR_INACTIVO"
  | "SUPERIOR_FUERA"
  | "OTRO_EQUIPO"
  | "AISLADO";

export interface PersonaOrganigrama {
  id: number;
  nombre: string;
  iniciales: string;
  /** Usuario de ingreso; solo lo recibe el superadmin. */
  usuario: string | null;
  celular: string | null;
  correo: string;
  activo: boolean;
  superiorId: number | null;
  rol: string | null;
  equipo: { nombre: string; tipo: string } | null;
  hoy: { locales: number; visitas: number; entrada: string | null; enCurso: boolean };
  alertas: AlertaOrganigrama[];
}

export interface Organigrama {
  empresa: { id: number; nombre: string };
  hoy: string;
  /** null: toda la empresa (superadmin). */
  raizId: number | null;
  personas: PersonaOrganigrama[];
}

export interface NodoOrganigrama {
  persona: PersonaOrganigrama;
  hijos: NodoOrganigrama[];
  /** Personas debajo, directas e indirectas. */
  total: number;
}
