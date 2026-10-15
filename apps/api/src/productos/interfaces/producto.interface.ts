import type { Prisma } from '../../../generated/prisma/client';
import { PRODUCTO_SELECT } from '../utils/selectores';

export type ProductoFila = Prisma.ProductoGetPayload<{
  select: typeof PRODUCTO_SELECT;
}>;
