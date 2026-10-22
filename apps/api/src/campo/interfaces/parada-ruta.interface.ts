import type { EstadoPresentismo, EstadoRuta } from './estado-jornada.interface';
export interface ParadaRuta {
  id: string;
  /** CardCode del socio de negocio (tbl_ocrd). */
  localId: string;
  local: string;
  tipo: string;
  ventana: string;
  estado: EstadoRuta;
  estadoPresentismo: EstadoPresentismo;
  checkin: string | null;
  checkout: string | null;
}
