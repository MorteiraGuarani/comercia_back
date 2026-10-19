import type {
  CumplimientoJornada,
  TareaJornada,
} from '../interfaces/tarea-jornada.interface';
import { estadoVisita } from './estado-jornada';
import { datosTareaRegistrada } from './version-tarea';

/** Campos de la tarea que ve quien la ejecuta en su jornada. */
export const TAREA_JORNADA_SELECT = {
  id: true,
  nombre: true,
  destinatario: true,
  descripcion: true,
  requiereFotos: true,
  fotosObligatorias: true,
  categoria: true,
  esObligatoria: true,
} as const;

export const CUMPLIMIENTO_JORNADA_SELECT = {
  visitaId: true,
  completadaAt: true,
  iniciadaAt: true,
  detalleTarea: true,
  versionTarea: true,
  visita: { select: { fecha: true, entrada: true, salida: true } },
  fotos: { select: { momento: true }, take: 2 },
} as const;

/** Solo los campos de TAREA_JORNADA_SELECT, sin lo que se pidió para filtrar. */
export function camposTareaJornada(t: TareaJornada): TareaJornada {
  return {
    id: t.id,
    nombre: t.nombre,
    destinatario: t.destinatario,
    descripcion: t.descripcion,
    requiereFotos: t.requiereFotos,
    fotosObligatorias: t.fotosObligatorias,
    categoria: t.categoria,
    esObligatoria: t.esObligatoria,
  };
}

/**
 * Tarea de la jornada con su avance: si hay una visita en curso usa la
 * versión de la tarea con la que se empezó; las completadas por visita y
 * si ya tiene fotos de antes y después.
 */
export function aTareaJornada(
  tarea: TareaJornada,
  cumplimientos: CumplimientoJornada[],
) {
  const enCurso = cumplimientos.find(
    (c) => c.completadaAt === null && estadoVisita(c.visita) === 'EN_CURSO',
  );
  return {
    ...datosTareaRegistrada(
      tarea,
      enCurso?.detalleTarea,
      enCurso?.versionTarea,
    ),
    iniciadaAt:
      cumplimientos.find(
        (c) =>
          c.iniciadaAt &&
          c.completadaAt === null &&
          estadoVisita(c.visita) === 'EN_CURSO',
      )?.iniciadaAt ?? null,
    visitasCompletadas: cumplimientos
      .filter((c) => c.completadaAt !== null)
      .map((c) => c.visitaId),
    tieneAntes: cumplimientos.some((c) =>
      c.fotos.some((foto) => foto.momento === 'ANTES'),
    ),
    tieneDespues: cumplimientos.some((c) =>
      c.fotos.some((foto) => foto.momento === 'DESPUES'),
    ),
  };
}
