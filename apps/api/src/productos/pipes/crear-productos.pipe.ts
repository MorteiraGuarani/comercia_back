import {
  BadRequestException,
  Injectable,
  PipeTransform,
  ValidationPipe,
} from '@nestjs/common';
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
        if (lote && error instanceof BadRequestException) {
          throw new BadRequestException({
            statusCode: 400,
            message: `Fila ${index + 1} inválida`,
            index,
            details: error.getResponse(),
          });
        }
        throw error;
      }
    }
    return lote ? productos : productos[0];
  }
}
