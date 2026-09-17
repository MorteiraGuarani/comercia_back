import type { RespuestaPaginada } from './paginacion';

export interface RespuestaCatalogoTareasCampo extends RespuestaPaginada<TareaCampo> {
  resumen: { total: number; obligatorias: number; conFotos: number };
}

export interface ClienteCampo {
  id: number;
  nombre: string;
  ruc: string;
  contacto: string;
  telefono: string;
  logoUrl?: string | null;
  activo: boolean;
  _count?: { locales: number };
}
export interface LocalCampo {
  id: number;
  clienteId: number;
  nombre: string;
  direccion: string;
  contacto: string;
  telefono: string;
  latitud: number;
  longitud: number;
  notas: string;
  activo: boolean;
  cliente: { id: number; nombre: string; logoUrl?: string | null };
}
export interface HorarioCampo {
  id: number;
  localId: number;
  frecuencia: "DIARIA" | "SEMANAL" | "MENSUAL";
  intervalo: number;
  diasSemana: number[];
  diasMes: number[];
  fechaDesde: string;
  fechaHasta: string | null;
  entrada: string;
  salida: string;
  activo: boolean;
}
export interface PersonaCampo {
  id: number;
  nombre: string;
  apellido: string;
}
export interface AsignacionCampo {
  id: number;
  localId: number;
  usuarioId: number;
  usuario: PersonaCampo;
  fechaDesde: string;
  fechaHasta: string | null;
  activo: boolean;
}
export interface BackupCampo {
  id: number;
  asignacionId: number;
  usuarioId: number;
  usuario: PersonaCampo;
  fechaDesde: string;
  fechaHasta: string;
  motivo: string;
  activo: boolean;
}
export interface TareaCampo {
  id: number;
  nombre: string;
  descripcion: string;
  todosLocales: boolean;
  activo: boolean;
  fechaDesde: string;
  fechaHasta: string | null;
  requiereFotos: boolean;
  fotosObligatorias: boolean;
  categoria?: string;
  esObligatoria?: boolean;
  estado?: "ABIERTA" | "CERRADA" | "CANCELADA";
  locales: { local: { id: number; nombre: string } }[];
}
export interface VisitaCampo {
  id: number;
  asignacionId: number;
  horarioId: number | null;
  fecha: string;
  entrada: string;
  salida: string | null;
  esBackup: boolean;
  notaEntrada: string;
  notaSalida: string;
  entradaLat: number | null;
  entradaLng: number | null;
  salidaLat: number | null;
  salidaLng: number | null;
  local: { id: number; nombre: string };
  usuario: PersonaCampo;
  asignacion: { usuario: PersonaCampo };
  _count: { cumplimientos: number };
}
export interface AgendaCampo {
  id: number;
  esBackup: boolean;
  titular: string;
  local: LocalCampo & { horarios: HorarioCampo[] };
  visitas: {
    id: number;
    horarioId: number | null;
    entrada: string;
    salida: string | null;
  }[];
}
export interface TareaJornadaCampo {
  id: number;
  nombre: string;
  descripcion: string;
  requiereFotos: boolean;
  fotosObligatorias: boolean;
  categoria?: string;
  esObligatoria?: boolean;
  visitasCompletadas: number[];
  completada?: boolean;
  completadaAt?: string;
  contadorComentarios?: number;
  tieneAntes?: boolean;
  tieneDespues?: boolean;
}
export interface FormHorarioCampo {
  frecuencia: HorarioCampo["frecuencia"];
  intervalo: number;
  diasSemana: number[];
  diasMes: number[];
  fechaDesde: string;
  fechaHasta: string;
  entrada: string;
  salida: string;
}
export interface FormTareaCampo {
  nombre: string;
  descripcion: string;
  todosLocales: boolean;
  activo: boolean;
  fechaDesde: string;
  fechaHasta: string;
  localIds: number[];
  requiereFotos: boolean;
  fotosObligatorias: boolean;
  categoria?: string;
  esObligatoria?: boolean;
  estado?: "ABIERTA" | "CERRADA" | "CANCELADA";
}
export interface MarcaCampo {
  latitud?: number;
  longitud?: number;
  nota: string;
}

// ========== COMENTARIOS ==========

export interface ComentarioTarea {
  id: number;
  comentario: string;
  usuario: {
    id: number;
    nombre: string;
    apellido: string;
  };
  creadoAt: string;
  leidoPorLider: boolean;
  leidoAt?: string;
}

export interface FormComentarioTarea {
  comentario: string;
}

// ========== FOTOS ==========

export type MomentoFoto = "ANTES" | "DESPUES";

export interface FotoTarea {
  id: number;
  momento: MomentoFoto;
  rutaArchivo: string;
  mimeType: string;
  tamanioBytes: number;
  creadoAt: string;
}

export interface FotosTareaResponse {
  antes?: FotoTarea;
  despues?: FotoTarea;
}

// ========== NOTIFICACIONES ==========

export type TipoNotificacion =
  | "COMENTARIO_TAREA"
  | "TAREA_COMPLETADA"
  | "FOTO_SUBIDA"
  | "NOVEDAD_CREADA"
  | "NOVEDAD_ACTUALIZADA"
  | "AVISO_RECIBIDO";

export interface Notificacion {
  id: number;
  tipo: TipoNotificacion;
  titulo: string;
  mensaje: string;
  usuarioEmisor: {
    id: number;
    nombre: string;
    apellido: string;
  };
  creadoAt: string;
  leido: boolean;
  leidoAt?: string;
  referenciaId?: number;
}

export interface ContadorNoLeidas {
  noLeidas: number;
}

// ========== NOVEDADES ==========

export type TipoNovedad = "RECLAMO" | "CONSULTA" | "SUGERENCIA" | "INCIDENCIA";
export type EstadoNovedad = "ABIERTA" | "CERRADA" | "CANCELADA";
export type PrioridadNovedad = "NORMAL" | "ALTA" | "CRITICA";

export interface NovedadCampoItem {
  id: number;
  tipo: TipoNovedad;
  estado: EstadoNovedad;
  prioridad: PrioridadNovedad;
  titulo: string;
  descripcion: string;
  resolucion?: string | null;
  usuario: {
    id: number;
    nombre: string;
    apellido: string;
  };
  local: {
    id: number;
    nombre: string;
    direccion: string;
    cliente?: {
      nombre: string;
    };
  };
  tarea?: {
    id: number;
    nombre: string;
    categoria?: string;
  } | null;
  cerradoPor?: {
    id: number;
    nombre: string;
    apellido: string;
  } | null;
  cerradoAt?: string | null;
  creadoAt: string;
}

export interface FormNovedadCampo {
  localId: number;
  tareaId?: number;
  visitaId?: number;
  tipo: TipoNovedad;
  prioridad?: PrioridadNovedad;
  titulo: string;
  descripcion: string;
}

export interface NovedadesResponse {
  items: NovedadCampoItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  counts: {
    abierta: number;
    cerrada: number;
    cancelada: number;
    total: number;
  };
}

// ========== AVISOS ==========

export type TipoAviso = "INDIVIDUAL" | "EQUIPO";

export interface AvisoEnviadoItem {
  id: number;
  tipo: TipoAviso;
  mensaje: string;
  destinatario?: {
    id: number;
    nombre: string;
    apellido: string;
  } | null;
  creadoAt: string;
  leido?: boolean;
  leidoAt?: string | null;
  leidoPor?: number;
  total?: number;
}

export interface AvisoRecibidoItem {
  id: number;
  tipo: TipoAviso;
  mensaje: string;
  emisor: {
    id: number;
    nombre: string;
    apellido: string;
  };
  creadoAt: string;
  leido: boolean;
  leidoAt?: string | null;
}

export interface FormAvisoCampo {
  tipo: TipoAviso;
  destinatarioId?: number;
  mensaje: string;
}

// ========== SUPERVISIÓN Y PRESENTISMO ==========

export interface ColaboradorResumen {
  id: number;
  nombre: string;
  iniciales: string;
  zona: string;
  telefono: string;
  asistencia: "en_curso" | "finalizado" | "sin_iniciar";
  inicioJornada: string | null;
  finJornada: string | null;
  ruta: {
    total: number;
    completadas: number;
    enCurso: number;
    pct: number;
  };
  tareas: {
    total: number;
    completadas: number;
    obligPendientes: number;
    pct: number;
  };
  novedadesCount: number;
}

export type ColaboradorResumenItem = ColaboradorResumen;

export interface SupervisionResumenData {
  fecha: string;
  presentismo: {
    enRuta: number;
    finalizados: number;
    sinIniciar: number;
    totalEquipo: number;
  };
  rutas: {
    total: number;
    completadas: number;
    enCurso: number;
    pendientes: number;
    pct: number;
  };
  tareas: {
    total: number;
    completadas: number;
    obligatoriasPendientes: number;
    pct: number;
  };
  colaboradores: ColaboradorResumenItem[];
}

export interface ParadaRutaColaborador {
  id: string;
  localId: number;
  cliente: string;
  local: string;
  tipo: "carniceria" | "supermercado" | "restaurante" | "tienda";
  ventana: string;
  estado: "completado" | "en_curso" | "pendiente";
  checkin: string | null;
  checkout: string | null;
}

export interface CategoriaTareasColaborador {
  categoria: string;
  completadas: number;
  total: number;
  obligPendiente: boolean;
  tareas: {
    id: number;
    nombre: string;
    esObligatoria: boolean;
    completada: boolean;
  }[];
}

export interface NovedadColaboradorItem {
  id: string;
  novedadId: number;
  tipo: string;
  estado: string;
  texto: string;
  cliente: string;
  hora: string;
}

export interface ColaboradorDetalleData {
  colaborador: {
    id: number;
    nombre: string;
    iniciales: string;
    zona: string;
    telefono: string;
    email?: string;
    asistencia: "en_curso" | "finalizado" | "sin_iniciar";
    inicioJornada: string | null;
    finJornada: string | null;
  };
  ruta: ParadaRutaColaborador[];
  tareasCategorias: CategoriaTareasColaborador[];
  novedades: NovedadColaboradorItem[];
}
