import type { RespuestaPaginada } from "./paginacion";

export interface RespuestaCatalogoTareasCampo extends RespuestaPaginada<TareaCampo> {
  resumen: { total: number; obligatorias: number; conFotos: number };
  permisos: {
    puedeAdministrar: boolean;
    consultar: boolean;
    crear: boolean;
    editar: boolean;
    archivar: boolean;
  };
}

export type RespuestaLocalesCampo = RespuestaPaginada<LocalCampo>;

/** Local de campo = socio de negocio de OCRD; el id es su CardCode. */
export interface LocalCampo {
  id: string;
  nombre: string;
  /** "Address, Street" de tbl_crd1 (prioriza la de entrega); vacío si no hay. */
  direccion: string;
  /** U_Latitud/U_Longitud de OCRD; null si SAP todavía no la tiene. */
  latitud: number | null;
  longitud: number | null;
  radioMetros: number;
  zonaHoraria: string;
  asignaciones?: Array<{
    id: number;
    usuario: PersonaCampo & { rol?: { descripcion: string } | null };
  }>;
}
export interface HorarioCampo {
  id: number;
  localId: string;
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
  localId: string;
  usuarioId: number;
  usuario: PersonaCampo & { localPrincipalId?: string | null };
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
  version: number;
  archivadaEn: string | null;
  nombre: string;
  destinatario: "IMPULSADOR" | "REPOSITOR" | "AMBOS";
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
  locales: { local: { id: string; nombre: string } }[];
}
export interface VisitaCampo {
  entradaColor?: string | null;
  salidaColor?: string | null;
  minutosComputables?: number | null;
  estado: import("./estado-jornada").EstadoVisita;
  estadoPresentismo: import("./estado-jornada").EstadoPresentismo;
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
  local: { id: string; nombre: string; radioMetros: number };
  usuario: PersonaCampo;
  asignacion: { usuario: PersonaCampo };
  _count: { cumplimientos: number };
}
export interface AgendaCampo {
  estado: import("./estado-jornada").EstadoRuta;
  estadoPresentismo: import("./estado-jornada").EstadoPresentismo;
  id: number;
  esBackup: boolean;
  titular: string;
  local: LocalCampo & { horarios: HorarioCampo[] };
  visitas: {
    id: number;
    horarioId: number | null;
    fecha: string;
    estado: import("./estado-jornada").EstadoVisita;
    estadoPresentismo: import("./estado-jornada").EstadoPresentismo;
    entrada: string;
    salida: string | null;
  }[];
}
export interface TareaJornadaCampo {
  id: number;
  iniciadaAt?: string | null;
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

/** Página de tareas de un local, tal como la devuelve `GET /campo/jornada/tareas`. */
export type TareasDeAsignacion = RespuestaPaginada<TareaJornadaCampo> & {
  asignacionId: number;
};
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
  destinatario: "IMPULSADOR" | "REPOSITOR" | "AMBOS";
  descripcion: string;
  todosLocales: boolean;
  activo: boolean;
  fechaDesde: string;
  fechaHasta: string;
  localIds: string[];
  requiereFotos: boolean;
  fotosObligatorias: boolean;
  categoria?: string;
  esObligatoria?: boolean;
  estado?: "ABIERTA" | "CERRADA" | "CANCELADA";
}
export interface MarcaCampo {
  latitud: number;
  longitud: number;
  precisionMetros: number;
  capturadaEn: string;
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

export interface AdjuntoCampoItem {
  id: number;
  nombreOriginal: string;
  mimeType: string;
  tamanioBytes: number;
  creadoAt: string;
}

// ========== NOTIFICACIONES ==========

export type TipoNotificacion =
  | "COMENTARIO_TAREA"
  | "TAREA_COMPLETADA"
  | "FOTO_SUBIDA"
  | "NOVEDAD_CREADA"
  | "NOVEDAD_ACTUALIZADA"
  | "NOVEDAD_RESPUESTA"
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
    id: string;
    nombre: string;
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
  adjuntos: AdjuntoCampoItem[];
}

export interface RespuestaNovedadCampo {
  id: number;
  mensaje: string;
  creadoAt: string;
  usuario: PersonaCampo;
}

export interface FormNovedadCampo {
  localId: string;
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

export type TipoAviso = "INDIVIDUAL" | "EQUIPO" | "SELECCION";
export type FrecuenciaAviso =
  "UNA_VEZ" | "HORARIA" | "DIARIA" | "SEMANAL" | "MENSUAL";

export interface DestinatarioAviso {
  id: number;
  nombre: string;
}

export interface ProgramacionAvisoItem {
  id: number;
  tipo: TipoAviso;
  mensaje: string;
  frecuencia: FrecuenciaAviso;
  fechaInicio: string;
  hora: string;
  intervaloHoras: number | null;
  diasSemana: number[];
  diaMes: number | null;
  fechaFin: string | null;
  proximoEnvioAt: string;
  ultimoEnvioAt: string | null;
  activo: boolean;
  destinatariosIds: number[];
}

export interface AvisoEnviadoItem {
  id: number;
  tipo: TipoAviso;
  mensaje: string;
  destinatario?: {
    id: number;
    nombre: string;
    apellido: string;
  } | null;
  destinatarios?: { id: number; nombre: string; apellido: string }[];
  creadoAt: string;
  leido?: boolean;
  leidoAt?: string | null;
  leidoPor?: number;
  total?: number;
  adjuntos: AdjuntoCampoItem[];
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
  adjuntos: AdjuntoCampoItem[];
}

export interface AvisoDetalleCampo {
  id: number;
  tipo: TipoAviso;
  mensaje: string;
  emisor: PersonaCampo;
  destinatario?: PersonaCampo | null;
  creadoAt: string;
  adjuntos: AdjuntoCampoItem[];
  leido: boolean;
}

export interface FormAvisoCampo {
  tipo: TipoAviso;
  destinatarioId?: number;
  destinatariosIds?: number[];
  mensaje: string;
  frecuencia?: FrecuenciaAviso;
  fechaInicio?: string;
  hora?: string;
  intervaloHoras?: number;
  diasSemana?: number[];
  diaMes?: number;
  fechaFin?: string;
}

// ========== SUPERVISIÓN Y PRESENTISMO ==========

export interface ColaboradorResumen {
  id: number;
  nombre: string;
  iniciales: string;
  zona: string;
  telefono: string;
  asistencia: import("./estado-jornada").AsistenciaCampo;
  estadoPresentismo: import("./estado-jornada").EstadoPresentismo;
  inicioJornada: string | null;
  finJornada: string | null;
  ruta: {
    total: number;
    completadas: number;
    enCurso: number;
    incompletas: number;
    ausentes: number;
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
  liderazgo: {
    totalTeamLeaders: number;
    enRuta: number;
    finalizados: number;
    sinIniciar: number;
    incompletos: number;
    ausentes: number;
    visitasCompletadas: number;
    visitasTotales: number;
    pctVisitas: number;
  };
  presentismo: {
    enRuta: number;
    finalizados: number;
    sinIniciar: number;
    incompletos: number;
    ausentes: number;
    estados: Record<import("./estado-jornada").EstadoPresentismo, number>;
    totalEquipo: number;
  };
  rutas: {
    total: number;
    completadas: number;
    enCurso: number;
    incompletas: number;
    ausentes: number;
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
  localId: string;
  local: string;
  tipo: "carniceria" | "supermercado" | "restaurante" | "tienda";
  ventana: string;
  estado: import("./estado-jornada").EstadoRuta;
  estadoPresentismo: import("./estado-jornada").EstadoPresentismo;
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
    asistencia: import("./estado-jornada").AsistenciaCampo;
    estadoPresentismo: import("./estado-jornada").EstadoPresentismo;
    inicioJornada: string | null;
    finJornada: string | null;
  };
  ruta: ParadaRutaColaborador[];
  tareasCategorias: CategoriaTareasColaborador[];
  evidencias: {
    visitaId: number;
    local: string;
    fecha: string;
    entrada: string;
    salida: string | null;
    estado: import("./estado-jornada").EstadoVisita;
    estadoPresentismo: import("./estado-jornada").EstadoPresentismo;
    tareaId: number;
    nombreTarea: string;
    completadaAt: string | null;
    fotos: { id: number; momento: MomentoFoto; creadoAt: string }[];
    comentarios: {
      id: number;
      comentario: string;
      creadoAt: string;
      usuario: { nombre: string; apellido: string };
    }[];
  }[];
  novedades: NovedadColaboradorItem[];
}

export interface PropsAvisosPanel {
  esImpulsador?: boolean;
  /** Llega en true desde el "+" de la campana: abre la redacción al entrar. */
  abrirRedactar?: boolean;
}
