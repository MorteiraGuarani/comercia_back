export type EstadoPresentismo =
  "SIN_REGISTRO" | "PRESENTE" | "EN_CURSO" | "INCOMPLETO" | "AUSENTE";
export type EstadoVisita = "EN_CURSO" | "CERRADA" | "INCOMPLETA";
export type EstadoRuta =
  "pendiente" | "en_curso" | "completado" | "incompleto" | "ausente";
/** Filtro de la agenda del repositor desde los KPIs. */
export type FiltroRuta = "todos" | "pendiente" | "en_curso" | "completado";
export type AsistenciaCampo =
  "sin_iniciar" | "en_curso" | "finalizado" | "incompleto" | "ausente";
