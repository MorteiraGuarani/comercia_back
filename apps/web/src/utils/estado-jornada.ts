import type { EstadoPresentismo, EstadoRuta } from "@/types/estado-jornada";

export const PRESENTISMO = {
  SIN_REGISTRO: { etiqueta: "Sin registro", tone: "sub", orden: 2 },
  PRESENTE: { etiqueta: "Presente", tone: "fresco", orden: 3 },
  TARDE: { etiqueta: "Tarde", tone: "alerta", orden: 4 },
  INCOMPLETO: { etiqueta: "Incompleto", tone: "alerta", orden: 0 },
  AUSENTE: { etiqueta: "Ausente", tone: "critico", orden: 1 },
} as const;

export const RUTA: Record<
  EstadoRuta,
  { etiqueta: string; tone: "sub" | "fresco" | "frio" | "alerta" | "critico" }
> = {
  pendiente: { etiqueta: "Pendiente", tone: "sub" },
  en_curso: { etiqueta: "En curso", tone: "frio" },
  completado: { etiqueta: "Visitado", tone: "fresco" },
  incompleto: { etiqueta: "Incompleto", tone: "alerta" },
  ausente: { etiqueta: "Ausente", tone: "critico" },
};

export function etiquetaPresentismo(estado: EstadoPresentismo) {
  return PRESENTISMO[estado].etiqueta;
}
