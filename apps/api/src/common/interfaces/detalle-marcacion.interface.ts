export type ValorSenal = string | number | boolean | null;
export interface DatosMarcacion {
  registradaEn: string;
  capturadaEn: string | null;
  recibidaEn: string | null;
  latitud: number | null;
  longitud: number | null;
  precisionMetros: number | null;
  distanciaMetros: number | null;
  centroLatitud: number | null;
  centroLongitud: number | null;
  radioMetros: number | null;
  fueraHorario: boolean | null;
  fueraAtencion: boolean | null;
  contexto: Record<string, ValorSenal>;
}
export interface DetalleMarcacion {
  id: number;
  usuario: { id: number; nombre: string };
  local: { id: number; nombre: string } | null;
  fecha: string;
  zonaHoraria: string;
  entrada: DatosMarcacion;
  salida: DatosMarcacion | null;
}
