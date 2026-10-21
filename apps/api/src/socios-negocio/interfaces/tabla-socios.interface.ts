import type { Type } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client';

export interface TablaSociosDefinicion {
  readonly nombre: string;
  readonly modelo: keyof Prisma.TransactionClient;
  readonly titulo: string;
  readonly Dto: Type<object>;
  readonly campos: readonly string[];
  readonly clave: readonly string[];
  readonly predeterminados: Readonly<Record<string, unknown>>;
  readonly busqueda: readonly string[];
  readonly identidad?: 'Code';
  readonly ejemplo: Readonly<Record<string, unknown>>;
}
