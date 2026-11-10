export type EstadoCargaInventario = "VIGENTE" | "POR_VENCER" | "VENCIDO";

export interface CargaInventarioFila {
  id: number;
  fecha: string;
  local: { id: string; nombre: string };
  itemcode: string;
  producto: string;
  cantidad: number;
  vencimiento: string;
  diasParaVencer: number;
  estado: EstadoCargaInventario;
  usuario: { id: number; nombre: string; rol: string; equipo: string | null; empresa: string };
  cargadaEn: string;
}
