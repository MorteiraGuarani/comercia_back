import { BadRequestException, PipeTransform } from '@nestjs/common';

/** CardCode de tbl_ocrd en la ruta: texto exacto (conserva ceros) de 1 a 50. */
export class CardCodePipe implements PipeTransform<unknown, string> {
  transform(valor: unknown) {
    if (typeof valor !== 'string' || valor.length < 1 || valor.length > 50)
      throw new BadRequestException('Código de cliente inválido');
    return valor;
  }
}
