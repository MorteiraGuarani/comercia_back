import { BadRequestException, ValidationPipe } from '@nestjs/common';
import type { PipeTransform, Type } from '@nestjs/common';
import type {
  FilaInvalida,
  LoteValidado,
} from '../interfaces/error-validacion.interface';
import {
  claveDe,
  excepcionConCampos,
  filaInvalida,
} from '../utils/errores-validacion';

/**
 * Valida antes de escribir. Un objeto inválido responde 400; en un bulk las
 * filas inválidas se separan e informan, y el resto sigue para guardarse.
 */
export class CargaTablaPipe implements PipeTransform {
  private readonly validacion: ValidationPipe;
  constructor(
    Dto: Type<object>,
    private readonly admiteLote = true,
    private readonly maximo = 50_000,
    /** Campos que identifican la fila en los errores del bulk (ej. ItemCode). */
    private readonly clave: readonly string[] = [],
  ) {
    this.validacion = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      expectedType: Dto,
      exceptionFactory: excepcionConCampos,
    });
  }
  async transform(
    value: unknown,
  ): Promise<Record<string, unknown> | LoteValidado> {
    const lote = Array.isArray(value);
    if (lote && !this.admiteLote)
      throw new BadRequestException(
        'La edición recibe un objeto, no un arreglo',
      );
    const filas: unknown[] = lote ? value : [value];
    if (filas.length < 1 || filas.length > this.maximo)
      throw new BadRequestException(
        `El lote debe contener entre 1 y ${this.maximo} filas`,
      );
    const validadas: Record<string, unknown>[] = [];
    const indices: number[] = [];
    const invalidas: FilaInvalida[] = [];
    for (const [index, fila] of filas.entries()) {
      try {
        if (!fila || typeof fila !== 'object' || Array.isArray(fila))
          throw new BadRequestException('Cada fila debe ser un objeto JSON');
        const validada = (await this.validacion.transform(fila, {
          type: 'body',
        })) as object;
        validadas.push(Object.fromEntries(Object.entries(validada)));
        indices.push(index);
      } catch (error: unknown) {
        if (!lote || !(error instanceof BadRequestException)) throw error;
        // Una fila mala no corta el bulk: se saltea y se informa.
        invalidas.push(filaInvalida(index, error, claveDe(fila, this.clave)));
      }
    }
    return lote
      ? { filas: validadas, indices, invalidas, recibidos: filas.length }
      : validadas[0];
  }
}
