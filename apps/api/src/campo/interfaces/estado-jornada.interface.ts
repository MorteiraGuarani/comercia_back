/**
 * Estados de Comercia (los mismos en todas las pantallas):
 * PRESENTE = Visitado, EN_CURSO, INCOMPLETO, AUSENTE y SIN_REGISTRO = Pendiente.
 * No existe "Tarde": la hora de llegada no cambia el estado.
 */
export type EstadoPresentismo =
  'SIN_REGISTRO' | 'PRESENTE' | 'EN_CURSO' | 'INCOMPLETO' | 'AUSENTE';
export type EstadoVisita = 'EN_CURSO' | 'CERRADA' | 'INCOMPLETA';
export type EstadoRuta =
  'pendiente' | 'en_curso' | 'completado' | 'incompleto' | 'ausente';
export type AsistenciaCampo =
  'sin_iniciar' | 'en_curso' | 'finalizado' | 'incompleto' | 'ausente';

export interface RegistroPresentismoCampo {
  toleranciasAplicadas?: unknown;
  fecha: Date | string;
  zonaHoraria?: string;
  horaDesde?: string | null;
  horaHasta?: string | null;
  entrada: Date | string | null;
  salida: Date | string | null;
}

export interface VisitaParaEstado {
  toleranciasAplicadas?: unknown;
  fecha: Date;
  entrada: Date;
  salida: Date | null;
  horarioId?: number | null;
  horario?: { entrada: string; salida: string } | null;
  eventosUcheck?: { horaDesde: string | null; horaHasta: string | null }[];
}
