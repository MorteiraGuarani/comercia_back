import { BadRequestException, ValidationPipe } from '@nestjs/common';
import type { PipeTransform, Type } from '@nestjs/common';

/** Valida todo el lote antes de permitir cualquier escritura. */
export class CargaTablaPipe implements PipeTransform {
  private readonly validacion: ValidationPipe;
  constructor(
    Dto: Type<object>,
    private readonly admiteLote = true,
    private readonly maximo = 50_000,
  ) {
    this.validacion = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      expectedType: Dto,
    });
  }
  async transform(
    value: unknown,
  ): Promise<Record<string, unknown> | Record<string, unknown>[]> {
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
    for (const [index, fila] of filas.entries()) {
      try {
        if (!fila || typeof fila !== 'object' || Array.isArray(fila))
          throw new BadRequestException('Cada fila debe ser un objeto JSON');
        const validada = (await this.validacion.transform(fila, {
          type: 'body',
        })) as object;
        validadas.push(Object.fromEntries(Object.entries(validada)));
      } catch (error: unknown) {
        if (lote && error instanceof BadRequestException)
          throw new BadRequestException({
            statusCode: 400,
            message: `Fila ${index + 1} inválida`,
            index,
            details: error.getResponse(),
          });
        throw error;
      }
    }
    return lote ? validadas : validadas[0];
  }
}
