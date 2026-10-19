import type {
  EstadoPresentismo,
  EstadoRuta,
  FiltroRuta,
} from "@/types/estado-jornada";

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

export const ETIQUETA_FILTRO: Record<FiltroRuta, string> = {
  todos: "Todos",
  pendiente: "Pendientes",
  en_curso: "En curso",
  completado: "Visitados",
};

/** Orden de la agenda del repositor: primero lo que está en curso, al final lo visitado. */
export const ORDEN_RUTA: Record<EstadoRuta, number> = {
  en_curso: 0,
  pendiente: 1,
  incompleto: 2,
  ausente: 3,
  completado: 4,
};

export function etiquetaPresentismo(estado: EstadoPresentismo) {
  return PRESENTISMO[estado].etiqueta;
}
