import type { Prisma } from '../../../generated/prisma/client';

// Activos en SAP: válidos y no congelados. SAP puede mandar Y/N o tYES/tNO.
export const activosAnd: Prisma.ProductoWhereInput[] = [
  { OR: [{ validFor: null }, { validFor: { notIn: ['N', 'tNO'] } }] },
  { OR: [{ frozenFor: null }, { frozenFor: { notIn: ['Y', 'tYES'] } }] },
];
