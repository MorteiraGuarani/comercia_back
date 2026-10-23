import {
  BadRequestException,
  Injectable,
  PipeTransform,
  ValidationPipe,
} from '@nestjs/common';
import type { FilaInvalida } from '../../common/interfaces/error-validacion.interface';
import {
  excepcionConCampos,
  excepcionLote,
  filaInvalida,
  MAX_FILAS_INVALIDAS,
} from '../../common/utils/errores-validacion';
import { CrearProductoDto } from '../dto/catalogo.dto';
import { MAX_PRODUCTOS_POR_LOTE } from '../productos.constants';

@Injectable()
export class CrearProductosPipe implements PipeTransform {
  private readonly validacion = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
    expectedType: CrearProductoDto,
    exceptionFactory: excepcionConCampos,
  });

  async transform(
    value: unknown,
  ): Promise<CrearProductoDto | CrearProductoDto[]> {
    const lote = Array.isArray(value);
    const filas: unknown[] = lote ? value : [value];
    if (filas.length === 0 || filas.length > MAX_PRODUCTOS_POR_LOTE)
      throw new BadRequestException(
        `El lote debe contener entre 1 y ${MAX_PRODUCTOS_POR_LOTE} productos`,
      );

    const productos: CrearProductoDto[] = [];
    const invalidas: FilaInvalida[] = [];
    for (const [index, fila] of filas.entries()) {
      try {
        if (!fila || typeof fila !== 'object' || Array.isArray(fila))
          throw new BadRequestException(
            'Cada producto debe ser un objeto JSON',
          );
        productos.push(
          (await this.validacion.transform(fila, {
            type: 'body',
          })) as CrearProductoDto,
        );
      } catch (error: unknown) {
        if (!lote || !(error instanceof BadRequestException)) throw error;
        if (invalidas.push(filaInvalida(index, error)) >= MAX_FILAS_INVALIDAS)
          break;
      }
    }
    if (invalidas.length) throw excepcionLote(invalidas);
    return lote ? productos : productos[0];
  }
}
