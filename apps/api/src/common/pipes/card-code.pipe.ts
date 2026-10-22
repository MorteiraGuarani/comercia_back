import { BadRequestException, PipeTransform } from '@nestjs/common';

/** CardCode de tbl_ocrd en la ruta: texto exacto (conserva ceros) de 1 a 15. */
export class CardCodePipe implements PipeTransform<unknown, string> {
  transform(valor: unknown) {
    if (typeof valor !== 'string' || valor.length < 1 || valor.length > 15)
      throw new BadRequestException('CardCode inválido');
    return valor;
  }
}
