import { ApiProperty } from '@nestjs/swagger';

export class ResumenLoteDto {
  @ApiProperty({ type: 'integer', minimum: 1, example: 3 }) recibidos!: number;
  @ApiProperty({ type: 'integer', minimum: 0, example: 1 }) insertados!: number;
  @ApiProperty({
    type: 'integer',
    minimum: 0,
    example: 1,
    description:
      'Claves únicas que ya estaban guardadas. Sus datos no se modifican.',
  })
  existentes!: number;
  @ApiProperty({
    type: 'integer',
    minimum: 0,
    example: 1,
    description: 'Repeticiones dentro del envío. Prevalece la primera fila.',
  })
  duplicadosEnLote!: number;
  @ApiProperty({
    type: 'integer',
    minimum: 0,
    example: 2,
    description:
      'existentes + duplicadosEnLote; recibidos = insertados + omitidos + invalidas.',
  })
  omitidos!: number;
  @ApiProperty({
    type: 'integer',
    minimum: 0,
    example: 1,
    description:
      'Filas salteadas por error: datos inválidos o, en tbl_itm1, un artículo que no existe en tbl_oitm. No cortan el lote.',
  })
  invalidas!: number;
  @ApiProperty({
    description:
      'Detalle de las filas salteadas (hasta 1000): fila desde uno, index desde cero, cada campo con su valor y mensajes, y el motivo en una línea.',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        index: { type: 'integer', minimum: 0, example: 0 },
        fila: { type: 'integer', minimum: 1, example: 1 },
        errores: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              campo: { type: 'string', example: 'SWeight1' },
              valor: { example: '' },
              mensajes: { type: 'array', items: { type: 'string' } },
            },
          },
        },
        motivo: {
          type: 'string',
          example:
            'SWeight1 = "": El decimal admite hasta 15 enteros y 6 decimales',
        },
      },
    },
  })
  filasInvalidas!: object[];
}
