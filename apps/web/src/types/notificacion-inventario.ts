export interface DetalleNotificacionInventario {
  id: number;
  fecha: string;
  cantidad: number;
  vencimiento: string;
  diasParaVencer: number;
  creadaEn: string;
  actualizadaEn: string;
  producto: { codigo: string; nombre: string };
  local: { codigo: string; nombre: string; direccion: string };
  autor: { id: number; nombre: string; rol: string | null };
}
