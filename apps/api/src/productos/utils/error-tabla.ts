import { ConflictException, NotFoundException } from '@nestjs/common';
import { codigoErrorPrisma } from '../../common/utils/error-prisma';
export function errorTabla(e: unknown): never {
  const code = codigoErrorPrisma(e);
  if (code === 'P2002')
    throw new ConflictException('Ya existe esa clave en la tabla y empresa');
  if (code === 'P2003')
    throw new ConflictException(
      'El artículo no existe en esta empresa o el registro tiene referencias relacionadas',
    );
  if (code === 'P2025')
    throw new NotFoundException('Registro no disponible en esta empresa');
  throw e;
}
