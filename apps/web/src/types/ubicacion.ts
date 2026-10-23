// /campo/ubicaciones: posición del equipo de campo durante la jornada.

export interface EstadoUbicacion {
  activa: boolean;
  intervaloSegundos: number;
}

/** Punto tomado por el navegador y guardado en el equipo hasta enviarlo. */
export interface PingPendiente {
  id?: number;
  usuarioId: number;
  latitud: number;
  longitud: number;
  precisionMetros: number;
  velocidadMps: number | null;
  rumboGrados: number | null;
  capturadaEn: string;
}

export interface RespuestaPings {
  guardados: number;
  descartados: number;
  activa: boolean;
}

export interface PosicionEnVivo {
  latitud: number;
  longitud: number;
  precisionMetros: number;
  velocidadMps: number | null;
  rumboGrados: number | null;
  capturadaEn: string;
}

export interface PersonaEnVivo {
  id: number;
  nombre: string;
  rol: string | null;
  ultima: PosicionEnVivo | null;
}

export interface EquipoEnVivo {
  empresa: { id: number; nombre: string };
  fecha: string;
  actualizadaEn: string;
  intervaloSegundos: number;
  personas: PersonaEnVivo[];
}

export interface PuntoRecorrido {
  latitud: number;
  longitud: number;
  precisionMetros: number;
  velocidadMps: number | null;
  capturadaEn: string;
}

export interface VisitaRecorrido {
  id: number;
  local: { id: string; nombre: string };
  latitud: number | null;
  longitud: number | null;
  entrada: string;
  salida: string | null;
}

export interface TramoRecorrido {
  tipo: "parada" | "movimiento" | "sin_datos";
  desde: string;
  hasta: string;
  minutos: number;
  metros: number;
  latitud?: number;
  longitud?: number;
  visitaId?: number | null;
}

export interface Recorrido {
  persona: { id: number; nombre: string };
  fecha: string;
  visitas: VisitaRecorrido[];
  puntos: PuntoRecorrido[];
  tramos: TramoRecorrido[];
  resumen: {
    puntos: number;
    descartados: number;
    metros: number;
    minutosDetenido: number;
    minutosEnMovimiento: number;
    minutosSinDatos: number;
    inicio: string | null;
    fin: string | null;
  };
}
