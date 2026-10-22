/**
 * Problemas de jerarquía que explican por qué alguien no aparece en el
 * Presentismo de su líder (o por qué un líder ve 0 personas).
 */
export type AlertaOrganigrama =
  | 'SIN_ROL'
  | 'SIN_EQUIPO'
  | 'SUPERIOR_INACTIVO'
  | 'SUPERIOR_FUERA'
  | 'OTRO_EQUIPO'
  | 'AISLADO';

/** Lo mínimo de cada persona que necesitan las reglas de alertas. */
export interface PersonaJerarquia {
  id: number;
  activo: boolean;
  superiorId: number | null;
  tieneRol: boolean;
  equipoId: number | null;
}

export interface PersonaOrganigrama {
  id: number;
  nombre: string;
  iniciales: string;
  /** Solo para superadmin: ayuda a saber qué cuenta es cada uno. */
  usuario: string | null;
  celular: string | null;
  correo: string;
  activo: boolean;
  /** null en la raíz de la vista (o si no tiene superior). */
  superiorId: number | null;
  rol: string | null;
  equipo: { nombre: string; tipo: string } | null;
  hoy: {
    /** Locales asignados vigentes hoy. */
    locales: number;
    visitas: number;
    /** Primera entrada de hoy, HH:mm. */
    entrada: string | null;
    /** Tiene una visita con entrada y sin salida. */
    enCurso: boolean;
  };
  alertas: AlertaOrganigrama[];
}

export interface OrganigramaRespuesta {
  empresa: { id: number; nombre: string };
  hoy: string;
  /** Persona desde la que se arma la vista; null = toda la empresa. */
  raizId: number | null;
  personas: PersonaOrganigrama[];
}
