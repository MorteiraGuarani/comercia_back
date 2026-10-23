export interface PuntoRecorrido {
  latitud: number;
  longitud: number;
  precisionMetros: number;
  velocidadMps: number | null;
  capturadaEn: Date;
}

export interface VisitaRecorrido {
  id: number;
  local: { id: string; nombre: string };
  latitud: number | null;
  longitud: number | null;
  entrada: Date;
  salida: Date | null;
}

export interface TramoRecorrido {
  tipo: 'parada' | 'movimiento' | 'sin_datos';
  desde: Date;
  hasta: Date;
  minutos: number;
  metros: number;
  /** Solo paradas: centro del lugar y visita marcada en ese rato. */
  latitud?: number;
  longitud?: number;
  visitaId?: number | null;
}

export interface ResumenRecorrido {
  puntos: number;
  /** Puntos con precisión peor que el máximo, fuera del cálculo y del trazo. */
  descartados: number;
  metros: number;
  minutosDetenido: number;
  minutosEnMovimiento: number;
  minutosSinDatos: number;
  inicio: Date | null;
  fin: Date | null;
}

export interface CalculoRecorrido {
  puntos: PuntoRecorrido[];
  tramos: TramoRecorrido[];
  resumen: ResumenRecorrido;
}
