import type { Prisma } from '../../../generated/prisma/client';
import type {
  CUMPLIMIENTO_JORNADA_SELECT,
  TAREA_JORNADA_SELECT,
} from '../utils/tarea-jornada';

export type TareaJornada = Prisma.TareaCampoGetPayload<{
  select: typeof TAREA_JORNADA_SELECT;
}>;

export type CumplimientoJornada = Prisma.CumplimientoCampoGetPayload<{
  select: typeof CUMPLIMIENTO_JORNADA_SELECT;
}>;
