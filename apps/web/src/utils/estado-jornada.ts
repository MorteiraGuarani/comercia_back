import type {
  EstadoPresentismo,
  EstadoRuta,
  FiltroRuta,
} from "@/types/estado-jornada";

// Los mismos estados y en el mismo orden en todos los módulos y roles.
// SIN_REGISTRO se muestra "Pendiente"; no existe "Tarde".
export const PRESENTISMO = {
  PRESENTE: { etiqueta: "Presente", tone: "fresco", orden: 0 },
  EN_CURSO: { etiqueta: "En curso", tone: "frio", orden: 1 },
  INCOMPLETO: { etiqueta: "Incompleto", tone: "alerta", orden: 2 },
  AUSENTE: { etiqueta: "Ausente", tone: "critico", orden: 3 },
  SIN_REGISTRO: { etiqueta: "Pendiente", tone: "sub", orden: 4 },
} as const;

export const RUTA: Record<
  EstadoRuta,
  { etiqueta: string; tone: "sub" | "fresco" | "frio" | "alerta" | "critico" }
> = {
  pendiente: { etiqueta: "Pendiente", tone: "sub" },
  en_curso: { etiqueta: "En curso", tone: "frio" },
  completado: { etiqueta: "Presente", tone: "fresco" },
  incompleto: { etiqueta: "Incompleto", tone: "alerta" },
  ausente: { etiqueta: "Ausente", tone: "critico" },
};

export const ETIQUETA_FILTRO: Record<FiltroRuta, string> = {
  todos: "Todos",
  pendiente: "Pendientes",
  en_curso: "En curso",
  completado: "Presentes",
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
