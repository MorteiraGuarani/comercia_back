export interface PosicionEnVivo {
  latitud: number;
  longitud: number;
  precisionMetros: number;
  velocidadMps: number | null;
  rumboGrados: number | null;
  capturadaEn: Date;
}

export interface PersonaEnVivo {
  id: number;
  nombre: string;
  rol: string | null;
  /** Última posición de hoy; null si todavía no mandó ninguna. */
  ultima: PosicionEnVivo | null;
}

export interface EquipoEnVivo {
  empresa: { id: number; nombre: string };
  fecha: string;
  actualizadaEn: Date;
  intervaloSegundos: number;
  personas: PersonaEnVivo[];
}
