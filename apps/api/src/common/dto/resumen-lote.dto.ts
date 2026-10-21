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
      'existentes + duplicadosEnLote; recibidos = insertados + omitidos.',
  })
  omitidos!: number;
}
