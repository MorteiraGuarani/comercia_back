import type { ColaboradorSeguimiento } from "@/types/seguimiento";

export function estadoUbicacion(
  persona: ColaboradorSeguimiento,
  ahora = Date.now(),
) {
  if (persona.telefono.estado !== "ACTUALIZADO") return persona.telefono.estado;
  const fecha = persona.telefono.capturadaEn;
  return fecha && ahora - new Date(fecha).getTime() <= 60000
    ? "ACTUALIZADO"
    : "DESACTUALIZADO";
}

export function textoEstadoUbicacion(
  estado: ColaboradorSeguimiento["telefono"]["estado"],
) {
  return {
    ACTUALIZADO: "Ubicación reciente",
    DESACTUALIZADO: "Ubicación desactualizada",
    SIN_DATOS: "Sin ubicación recibida",
    FINALIZADO: "Seguimiento finalizado",
  }[estado];
}
