import { ConflictException, NotFoundException } from '@nestjs/common';

export function errorCatalogo(error: unknown): never {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    if (error.code === 'P2002')
      throw new ConflictException('Ya existe ese CardCode en la empresa');
    if (error.code === 'P2025' || error.code === 'P2003')
      throw new NotFoundException('Registro no disponible en esta empresa');
  }
  throw error;
}
