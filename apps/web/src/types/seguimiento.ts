import type { RespuestaPaginada } from "./paginacion";

export interface ColaboradorSeguimiento {
  id: number;
  nombre: string;
  rol: string;
  vinculada: boolean;
  telefono: {
    estado: "SIN_DATOS" | "FINALIZADO" | "ACTUALIZADO" | "DESACTUALIZADO";
    antiguedadSegundos: number | null;
    capturadaEn: string | null;
    precisionMetros: number | null;
    latitud: number | null;
    longitud: number | null;
  };
  visita: {
    id: number;
    entrada: string;
    local: { id: number; nombre: string; latitud: number; longitud: number };
    completadas: number;
    totalTareas: number;
    actividad: {
      tareaId: number;
      nombre: string;
      estado: "COMPLETADA" | "INICIADA" | "EVIDENCIAS";
      fecha: string;
    } | null;
  } | null;
}

export interface RespuestaSeguimiento extends RespuestaPaginada<ColaboradorSeguimiento> {
  actualizadaEn: string;
  resumen: {
    colaboradores: number;
    ubicacionesRecientes: number;
    sinUbicacionReciente: number;
    visitasAbiertas: number;
    operacionesPendientes: number;
  };
}

export interface MarcacionPendiente {
  estado: "PENDIENTE";
  operacionId: string;
  mensaje: string;
}

export interface EstadoTelefonoRepositor {
  estado:
    | "LISTO"
    | "SIN_DATOS"
    | "DESACTUALIZADO"
    | "NO_HABILITADO"
    | "SIN_CONEXION"
    | "SEGUIMIENTO_DETENIDO";
  mensaje: string;
  capturadaEn?: string | null;
  precisionMetros?: number | null;
}
