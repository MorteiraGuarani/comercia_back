import { BadRequestException, ValidationPipe } from '@nestjs/common';
import type { PipeTransform, Type } from '@nestjs/common';
import type { FilasLoteUsuarios } from '../interfaces/lote-usuarios.interface';
import { mensajeErrorLote } from '../utils/lote-usuarios';

export const MAX_USUARIOS_POR_LOTE = 500;

/**
 * Acepta un objeto o un arreglo y valida cada fila por separado: en un lote,
 * una fila inválida no frena a las demás y su error vuelve en la respuesta.
 */
export class LoteUsuariosPipe<T extends object> implements PipeTransform {
  private readonly validacion: ValidationPipe;
  constructor(Dto: Type<T>) {
    this.validacion = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      expectedType: Dto,
    });
  }

  async transform(value: unknown): Promise<FilasLoteUsuarios<T>> {
    const lote = Array.isArray(value);
    const filas: unknown[] = lote ? value : [value];
    if (filas.length < 1 || filas.length > MAX_USUARIOS_POR_LOTE)
      throw new BadRequestException(
        `El lote debe tener entre 1 y ${MAX_USUARIOS_POR_LOTE} usuarios`,
      );
    const validadas: FilasLoteUsuarios<T>['filas'] = [];
    for (const fila of filas) {
      try {
        if (!fila || typeof fila !== 'object' || Array.isArray(fila))
          throw new BadRequestException('Cada usuario debe ser un objeto JSON');
        validadas.push({
          dto: (await this.validacion.transform(fila, { type: 'body' })) as T,
        });
      } catch (error: unknown) {
        if (!lote) throw error;
        validadas.push({ error: mensajeErrorLote(error) });
      }
    }
    return { lote, filas: validadas };
  }
}
