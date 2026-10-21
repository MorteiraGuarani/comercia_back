import { ConflictException, NotFoundException } from '@nestjs/common';
import { codigoErrorPrisma } from '../../common/utils/error-prisma';

export function errorSocios(error: unknown): never {
  const codigo = codigoErrorPrisma(error);
  if (codigo === 'P2002')
    throw new ConflictException('Ya existe esa clave en la tabla y empresa');
  if (codigo === 'P2025' || codigo === 'P2003')
    throw new NotFoundException('Registro no disponible en esta empresa');
  throw error;
}
