import type { Prisma } from '../../../generated/prisma/client';
import {
  PRECIO_ESPECIAL_DETALLE_SELECT,
  PRECIO_ESPECIAL_SELECT,
} from '../utils/selectores';

export type PrecioEspecialFila = Prisma.PrecioEspecialGetPayload<{
  select: typeof PRECIO_ESPECIAL_SELECT;
}>;

export type PrecioEspecialDetalleFila = Prisma.PrecioEspecialDetalleGetPayload<{
  select: typeof PRECIO_ESPECIAL_DETALLE_SELECT;
}>;
