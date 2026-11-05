export interface ReglaHorario {
  frecuencia: 'DIARIA' | 'SEMANAL' | 'MENSUAL';
  intervalo: number;
  diasSemana: number[];
  diasMes: number[];
  fechaDesde: Date;
  fechaHasta: Date | null;
  entrada: string;
  salida: string;
}

export interface FilaAgendaId {
  id: number;
  /** Equipo del titular: define los horarios de la asignación. */
  equipo: number | null;
}
export interface TotalAgenda {
  total: bigint;
}
