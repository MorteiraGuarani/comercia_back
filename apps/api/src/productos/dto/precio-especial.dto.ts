import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDate,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginacionDto } from '../../common/utils/paginacion';
import {
  MAX_INT2,
  MAX_INT4,
  MIN_INT2,
  MIN_INT4,
} from '../../common/utils/numeros';
import { trimString } from '../../common/utils/transforms';
import { EmpresaCatalogoParams } from './catalogo.dto';

// Los NUMERIC(21,6) viajan como texto para conservar los 21 dígitos sin el
// redondeo de JavaScript.
const DECIMAL = /^(?:0|[1-9]\d{0,14})(?:\.\d{1,6})?$/;
const DECIMAL_CON_SIGNO = /^-?(?:0|[1-9]\d{0,14})(?:\.\d{1,6})?$/;
const DECIMAL_AYUDA =
  'Texto con hasta 15 enteros y 6 decimales, punto como separador.';

export class ConsultaPrecioEspecialDto extends PaginacionDto {
  @ApiPropertyOptional({
    description:
      'Texto a buscar en códigos y nombres (contiene, sin distinguir mayúsculas).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  buscar?: string;

  @ApiPropertyOptional({
    description: 'Código exacto del cliente (CardCode).',
    example: 'C00123',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  cardCode?: string;

  @ApiPropertyOptional({
    description: 'Código exacto del artículo (ItemCode).',
    example: 'A0001',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  itemCode?: string;
}

export class PrecioEspecialParams extends EmpresaCatalogoParams {
  @ApiProperty({
    description: 'ID del registro. Es BIGSERIAL y viaja como texto.',
    example: '1',
  })
  @Matches(/^[1-9]\d{0,17}$/)
  id!: string;
}

// Todos los campos son opcionales. En PATCH solo cambian los enviados y
// null vacía el campo.
export class PrecioEspecialDto {
  @ApiPropertyOptional({
    description: 'Código del cliente (CardCode).',
    example: 'C00123',
    nullable: true,
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(50)
  cardCode?: string | null;

  @ApiPropertyOptional({
    description: 'Nombre del cliente.',
    example: 'Supermercado Central',
    nullable: true,
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(200)
  cardName?: string | null;

  @ApiPropertyOptional({
    description: 'Tipo de socio de negocio.',
    example: 'C',
    nullable: true,
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(20)
  cardType?: string | null;

  @ApiPropertyOptional({
    description: 'Nombre de la lista de precios.',
    example: 'Mayorista',
    nullable: true,
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(100)
  listPriceName?: string | null;

  @ApiPropertyOptional({
    description: 'Número de la lista de precios.',
    example: 1,
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @Min(MIN_INT4)
  @Max(MAX_INT4)
  listPriceCod?: number | null;

  @ApiPropertyOptional({
    description: 'Código del artículo (ItemCode).',
    example: 'A0001',
    nullable: true,
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(50)
  itemCode?: string | null;

  @ApiPropertyOptional({
    description: 'Descripción del artículo.',
    example: 'Carne molida especial 1 kg',
    nullable: true,
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(200)
  itemName?: string | null;

  @ApiPropertyOptional({
    description: `Precio especial. ${DECIMAL_AYUDA} Si se omite al crear, queda en 0.`,
    example: '15000.5',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @Matches(DECIMAL)
  price?: string | null;

  @ApiPropertyOptional({
    description: 'Unidad de medida.',
    example: 'KG',
    nullable: true,
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(20)
  um?: string | null;

  @ApiPropertyOptional({
    description: 'Código del grupo de artículos.',
    example: 100,
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @Min(MIN_INT4)
  @Max(MAX_INT4)
  itmsGrpCode?: number | null;

  @ApiPropertyOptional({
    description: 'Nombre del grupo de artículos.',
    example: 'Carnes',
    nullable: true,
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(200)
  itmsGrpNam?: string | null;

  @ApiPropertyOptional({
    description: 'Vigente: Y (sí) o N (no). Si se omite al crear, queda en Y.',
    enum: ['Y', 'N'],
    example: 'Y',
    nullable: true,
  })
  @IsOptional()
  @IsIn(['Y', 'N'])
  valid?: 'Y' | 'N' | null;
}

// Todos los campos son opcionales. En PATCH solo cambian los enviados y
// null vacía el campo.
export class PrecioEspecialDetalleDto {
  @ApiPropertyOptional({
    description: 'Código del artículo (ItemCode).',
    example: 'A0001',
    nullable: true,
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(50)
  itemCode?: string | null;

  @ApiPropertyOptional({
    description: 'Código del cliente (CardCode).',
    example: 'C00123',
    nullable: true,
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(15)
  cardCode?: string | null;

  @ApiPropertyOptional({
    description: 'Número de línea del detalle.',
    example: 0,
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @Min(MIN_INT2)
  @Max(MAX_INT2)
  lineNum?: number | null;

  @ApiPropertyOptional({
    description: `Precio del período. ${DECIMAL_AYUDA}`,
    example: '14500',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @Matches(DECIMAL)
  price?: string | null;

  @ApiPropertyOptional({
    description: 'Moneda (código de hasta 3 letras).',
    example: 'GS',
    nullable: true,
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(3)
  currency?: string | null;

  @ApiPropertyOptional({
    description: `Descuento; admite negativos. ${DECIMAL_AYUDA}`,
    example: '5.5',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @Matches(DECIMAL_CON_SIGNO)
  discount?: string | null;

  @ApiPropertyOptional({
    description:
      'Número de lista de precios. Si se omite al crear, queda en 0.',
    example: 1,
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @Min(MIN_INT2)
  @Max(MAX_INT2)
  listNum?: number | null;

  @ApiPropertyOptional({
    description: 'Inicio de vigencia (fecha u hora ISO 8601).',
    example: '2026-10-01',
    nullable: true,
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  fromDate?: Date | null;

  @ApiPropertyOptional({
    description: 'Fin de vigencia (fecha u hora ISO 8601).',
    example: '2026-12-31',
    nullable: true,
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  toDate?: Date | null;
}

export class PrecioEspecialRespuestaDto {
  @ApiProperty({ example: '1' }) id!: string;
  cardCode!: string | null;
  cardName!: string | null;
  cardType!: string | null;
  listPriceName!: string | null;
  listPriceCod!: number | null;
  itemCode!: string | null;
  itemName!: string | null;
  @ApiProperty({ example: '15000.500000', nullable: true })
  price!: string | null;
  um!: string | null;
  itmsGrpCode!: number | null;
  itmsGrpNam!: string | null;
  valid!: string | null;
}

export class PrecioEspecialDetalleRespuestaDto {
  @ApiProperty({ example: '1' }) id!: string;
  itemCode!: string | null;
  cardCode!: string | null;
  lineNum!: number | null;
  @ApiProperty({ example: '14500.000000', nullable: true })
  price!: string | null;
  currency!: string | null;
  @ApiProperty({ example: '5.500000', nullable: true })
  discount!: string | null;
  listNum!: number | null;
  fromDate!: Date | null;
  toDate!: Date | null;
}

export class PaginaPrecioEspecialDto {
  items!: PrecioEspecialRespuestaDto[];
  total!: number;
  page!: number;
  limit!: number;
  totalPages!: number;
}

export class PaginaPrecioEspecialDetalleDto {
  items!: PrecioEspecialDetalleRespuestaDto[];
  total!: number;
  page!: number;
  limit!: number;
  totalPages!: number;
}
