import type { Type } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client';
export interface TablaProductos {
  nombre: string;
  titulo: string;
  modelo: keyof Prisma.TransactionClient;
  Dto: Type<object>;
  columnas: Readonly<Record<string, string>>;
  clave: readonly string[];
  textos: readonly string[];
  decimales: readonly string[];
  ejemplo: Readonly<Record<string, unknown>>;
  protegida: boolean;
  alias?: string;
}
