import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PaginacionDto } from '../../common/utils/paginacion';

const INT4_MIN = -2147483648;
const INT4_MAX = 2147483647;
const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class ConsultaCategoriasDto extends PaginacionDto {
  @ApiPropertyOptional({
    example: 'hambur',
    description: 'Busca por nombre de categoría.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  buscar?: string;
}

export class CrearCategoriaDto {
  @ApiProperty({ example: 'Hamburguesas', maxLength: 100 })
  @Transform(recortar)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  nombre_categoria!: string;

  @ApiPropertyOptional({
    type: 'integer',
    nullable: true,
    example: 144,
    description:
      'Grupo de artículos de SAP: tbl_oitb.Number (OITM.ItemsGroupCode) de la misma empresa. Vacío = sin grupo.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(INT4_MIN)
  @Max(INT4_MAX)
  ItemGroupCode?: number | null;

  @ApiPropertyOptional({
    nullable: true,
    enum: ['I', 'G'],
    example: 'I',
    description:
      'I = pestaña propia en Pedidos, en el orden de la categoría. G = sus productos van en «Otros».',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsIn(['I', 'G'], { message: 'Modo debe ser I (individual) o G (en Otros)' })
  Modo?: 'I' | 'G' | null;

  @ApiPropertyOptional({
    type: 'integer',
    example: 1,
    default: 0,
    description: 'Posición en el asistente de pedidos (menor primero).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(INT4_MIN)
  @Max(INT4_MAX)
  orden?: number;
}

export class ActualizarCategoriaDto extends PartialType(CrearCategoriaDto) {}
