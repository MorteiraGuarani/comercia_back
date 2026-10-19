import { ConflictException, NotFoundException } from '@nestjs/common';
import { codigoErrorPrisma } from '../../common/utils/error-prisma';

export function errorCatalogo(
  error: unknown,
  duplicado = 'Ya existe ese CardCode en la empresa',
): never {
  const codigo = codigoErrorPrisma(error);
  if (codigo === 'P2002') throw new ConflictException(duplicado);
  if (codigo === 'P2025' || codigo === 'P2003')
    throw new NotFoundException('Registro no disponible en esta empresa');
  throw error;
}
