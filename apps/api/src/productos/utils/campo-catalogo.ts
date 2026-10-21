import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDefined,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateBy,
  ValidateIf,
} from 'class-validator';
import type { CampoCatalogo } from '../interfaces/campo-catalogo.interface';
import { trimString } from '../../common/utils/transforms';
import { esPrecioProducto } from './producto';

export function CampoTabla(c: CampoCatalogo) {
  const minimo = c.small ? -32768 : -2147483648;
  const maximo = c.small ? 32767 : 2147483647;
  const api = c.requerido ? ApiProperty : ApiPropertyOptional;
  const swagger =
    c.tipo === 'decimal'
      ? api({
          nullable: true,
          oneOf: [
            { type: 'number' },
            {
              type: 'string',
              pattern: '^-?(?:0|[1-9][0-9]{0,14})(?:\\.[0-9]{1,6})?$',
            },
          ],
          description:
            c.descripcion +
            ' NUMERIC(21,6). Acepta número o texto decimal exacto; responde texto con seis decimales.',
          example: c.ejemplo,
        })
      : c.tipo === 'entero'
        ? api({
            type: 'integer',
            minimum: minimo,
            maximum: maximo,
            nullable: c.nullable ?? false,
            default: c.defecto,
            description: c.descripcion,
            example: c.ejemplo,
          })
        : api({
            type: String,
            maxLength: c.longitud,
            minLength: c.requerido ? 1 : undefined,
            nullable: c.nullable ?? false,
            default: c.defecto,
            description: c.descripcion,
            example: c.ejemplo,
          });
  return applyDecorators(
    swagger,
    ...(c.nullable
      ? [IsOptional()]
      : c.requerido
        ? [IsDefined()]
        : [ValidateIf((_obj: object, v: unknown) => v !== undefined)]),
    ...(c.tipo === 'texto'
      ? [
          Transform(trimString),
          IsString(),
          MaxLength(c.longitud!),
          ...(c.requerido ? [MinLength(1)] : []),
        ]
      : c.tipo === 'entero'
        ? [IsInt(), Min(minimo), Max(maximo)]
        : [
            ValidateBy({
              name: 'decimal21_6',
              validator: {
                validate: esPrecioProducto,
                defaultMessage: () =>
                  'El decimal admite hasta 15 enteros y 6 decimales',
              },
            }),
          ]),
  );
}
