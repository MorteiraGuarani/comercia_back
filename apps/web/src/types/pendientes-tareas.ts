export interface AccionTareaPendiente {
  id: string;
  usuarioId: number;
  ruta: string;
  etiqueta: string;
  creadaEn: number;
  estado: "PENDIENTE" | "REVISAR";
  error: string | null;
  cuerpo: string | null;
  campos?: Array<{ nombre: string; valor: string | Blob; archivo?: string }>;
}

export interface ResultadoAccionTarea<T> {
  pendiente: boolean;
  resultado: T | null;
  id: string;
}
