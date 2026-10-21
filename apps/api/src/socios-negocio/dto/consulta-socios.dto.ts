import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateBy,
} from 'class-validator';
import {
  PaginacionDto,
  PAGINA_TAMANO_DEFECTO,
  PAGINA_TAMANO_MAXIMO,
} from '../../common/utils/paginacion';
import { MAX_INT4 } from '../../common/utils/numeros';
import { esIdBigint } from '../../common/utils/identificadores';

export class ConsultaSociosDto extends PaginacionDto {
  @ApiPropertyOptional({
    type: 'integer',
    minimum: 1,
    maximum: Math.floor(MAX_INT4 / PAGINA_TAMANO_MAXIMO),
    default: 1,
    description: 'Página a consultar, comenzando en 1.',
  })
  @Max(Math.floor(MAX_INT4 / PAGINA_TAMANO_MAXIMO))
  declare page?: number;

  @ApiPropertyOptional({
    type: 'integer',
    minimum: 1,
    maximum: PAGINA_TAMANO_MAXIMO,
    default: PAGINA_TAMANO_DEFECTO,
    description: 'Cantidad de filas por página.',
  })
  declare limit?: number;

  @ApiPropertyOptional({
    maxLength: 200,
    description:
      'Buscar en los campos de texto y en el código numérico de la tabla.',
    example: 'ejemplo',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  buscar?: string;
}

export class EmpresaSociosParams {
  @ApiProperty({
    type: 'integer',
    minimum: 1,
    maximum: MAX_INT4,
    example: 1,
    description:
      'Empresa existente. La ruta determina la empresa; empresa_id no se acepta en el JSON.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_INT4)
  empresaId!: number;
}

export class RegistroSociosParams extends EmpresaSociosParams {
  @ApiProperty({
    type: String,
    pattern: '^[1-9][0-9]{0,18}$',
    maxLength: 19,
    example: '1',
    description:
      'ID técnico BIGINT de la fila, como texto. Los códigos originales se conservan en sus columnas.',
  })
  @ValidateBy({ name: 'idBigint', validator: { validate: esIdBigint } })
  id!: string;
}
