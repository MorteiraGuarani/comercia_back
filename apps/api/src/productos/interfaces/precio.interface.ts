import type { Prisma } from '../../../generated/prisma/client';
import { PRECIO_SELECT } from '../utils/selectores';

export type PrecioFila = Prisma.PrecioGetPayload<{
  select: typeof PRECIO_SELECT;
}>;
