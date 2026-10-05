export interface MarcacionRepositorUcheck {
  ucheckJornadaId: number;
  fecha: string;
  tipo: 'ENTRADA' | 'SALIDA';
  estado?: 'CONFIRMADA' | 'PENDIENTE';
  operacionId?: string;
  mensaje?: string;
}
