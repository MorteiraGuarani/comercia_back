import {
  BadRequestException,
  PipeTransform,
  ValidationPipe,
} from '@nestjs/common';
import type { Type } from '@nestjs/common';
import { MAX_SOCIOS_POR_LOTE } from '../tablas-socios';
import type { EntradaSocio } from '../interfaces/registro-socio.interface';

export class CrearSociosPipe implements PipeTransform {
  private readonly validacion: ValidationPipe;
  constructor(
    Dto: Type<object>,
    private readonly admiteLote = true,
  ) {
    this.validacion = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      expectedType: Dto,
    });
  }

  async transform(value: unknown): Promise<EntradaSocio | EntradaSocio[]> {
    const lote = Array.isArray(value);
    if (lote && !this.admiteLote)
      throw new BadRequestException(
        'La edición recibe un objeto, no un arreglo',
      );
    const filas: unknown[] = lote ? value : [value];
    if (filas.length < 1 || filas.length > MAX_SOCIOS_POR_LOTE)
      throw new BadRequestException(
        `El lote debe contener entre 1 y ${MAX_SOCIOS_POR_LOTE} filas`,
      );
    const validadas: EntradaSocio[] = [];
    for (const [index, fila] of filas.entries()) {
      try {
        if (!fila || typeof fila !== 'object' || Array.isArray(fila))
          throw new BadRequestException('Cada fila debe ser un objeto JSON');
        const validada = (await this.validacion.transform(fila, {
          type: 'body',
        })) as object;
        // Prisma recibe solo las propiedades propias validadas, nunca métodos ni prototipos.
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
