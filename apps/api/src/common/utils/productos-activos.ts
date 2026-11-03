import type { Prisma } from '../../../generated/prisma/client';

// Activos en SAP: válidos y no congelados.
export const activosAnd: Prisma.ProductoWhereInput[] = [
  { OR: [{ validFor: null }, { validFor: { not: 'N' } }] },
  { OR: [{ frozenFor: null }, { frozenFor: { not: 'Y' } }] },
];
