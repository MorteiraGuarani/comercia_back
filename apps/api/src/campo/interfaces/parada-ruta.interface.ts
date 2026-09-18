export interface ParadaRuta {
  id: string;
  localId: number;
  cliente: string;
  local: string;
  tipo: string;
  ventana: string;
  estado: 'completado' | 'en_curso' | 'pendiente';
  checkin: string | null;
  checkout: string | null;
}
