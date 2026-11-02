import type { MarcaSinConexion, PersonaCampo, VisitaCampo } from "@/types/campo";

/**
 * Una entrada guardada en el navegador sin conexión se ve en la ruta como la
 * visita en curso (id -1: todavía no existe en Comercia), para poder
 * finalizarla también sin conexión.
 */
export function visitaSinConexion(
  marca: MarcaSinConexion,
  persona: PersonaCampo,
): VisitaCampo {
  return {
    id: -1,
    asignacionId: marca.asignacionId,
    horarioId: marca.horarioId,
    fecha: marca.fecha,
    entrada: marca.tomadaEn,
    salida: null,
    estado: "EN_CURSO",
    estadoPresentismo: "EN_CURSO",
    esBackup: false,
    notaEntrada: marca.nota,
    notaSalida: "",
    entradaLat: marca.ubicacion.latitud,
    entradaLng: marca.ubicacion.longitud,
    salidaLat: null,
    salidaLng: null,
    local: marca.local,
    usuario: persona,
    asignacion: { usuario: persona },
    _count: { cumplimientos: 0 },
  };
}
