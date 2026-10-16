import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateBy,
} from 'class-validator';
import { PaginacionDto } from '../../common/utils/paginacion';
import {
  MAX_INT2,
  MAX_INT4,
  MIN_INT2,
  MIN_INT4,
} from '../../common/utils/numeros';
import { trimString } from '../../common/utils/transforms';
import { esIdProducto, esPrecioProducto } from '../utils/producto';

export class ConsultaCatalogoDto extends PaginacionDto {
  @IsOptional() @IsString() @MaxLength(200) buscar?: string;
  @IsOptional() @IsString() @MaxLength(50) itemcode?: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(MIN_INT2)
  @Max(MAX_INT2)
  pricelist?: number;
}

export class EmpresaCatalogoParams {
  @Type(() => Number) @IsInt() @Min(1) @Max(MAX_INT4) empresaId!: number;
}

export class ProductoCatalogoParams extends EmpresaCatalogoParams {
  @ApiProperty({
    type: String,
    example: '1',
    description: 'ID BIGSERIAL del artículo y lista, como texto.',
  })
  @ValidateBy({ name: 'idProducto', validator: { validate: esIdProducto } })
  id!: string;
}

// Una fila de tbl_itm1 por artículo y lista. empresa_id proviene de la ruta.
export class DatosProductoDto {
  @ApiProperty({
    type: String,
    maxLength: 50,
    example: 'A0001',
    description:
      'Código de artículo. Puede repetirse con distinto pricelist dentro de la empresa.',
  })
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  itemcode!: string;
  @ApiProperty({ type: String, maxLength: 200, example: 'Artículo de ejemplo' })
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  itemname!: string;
  @ApiProperty({
    type: 'integer',
    format: 'int32',
    minimum: MIN_INT2,
    maximum: MAX_INT2,
    example: 10,
    description: 'SMALLINT (int2).',
  })
  @IsInt()
  @Min(MIN_INT2)
  @Max(MAX_INT2)
  iva!: number;
  @ApiProperty({
    type: 'integer',
    format: 'int32',
    minimum: MIN_INT4,
    maximum: MAX_INT4,
    example: 100,
    description: 'INTEGER (int4).',
  })
  @IsInt()
  @Min(MIN_INT4)
  @Max(MAX_INT4)
  itmsgrpcode!: number;
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 200,
    example: 'Alimentos',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  itmsgrpnam?: string | null;
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    default: 'Y',
    maxLength: 1,
    example: 'Y',
    description: 'CHAR(1), admite null. Al crear, usa Y si se omite.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1)
  inventory?: string | null;
  @ApiProperty({
    type: 'integer',
    format: 'int32',
    minimum: MIN_INT2,
    maximum: MAX_INT2,
    example: 1,
    description:
      'SMALLINT (int2). Junto a itemcode identifica la fila dentro de la empresa; no puede repetirse esa pareja.',
  })
  @IsInt()
  @Min(MIN_INT2)
  @Max(MAX_INT2)
  pricelist!: number;
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 200,
    example: 'General',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  pricelistname?: string | null;
  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    example: 15000.123456,
    description:
      'NUMERIC(21,6): número JSON con hasta 15 enteros y 6 decimales. También acepta texto decimal exacto por compatibilidad.',
  })
  @IsOptional()
  @ValidateBy({
    name: 'precioProducto',
    validator: {
      validate: esPrecioProducto,
      defaultMessage: () =>
        'price debe ser numérico, con hasta 15 enteros y 6 decimales',
    },
  })
  price?: number | string | null;
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 50,
    example: 'Artículo',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  tipo?: string | null;
}

export class CrearProductoDto extends DatosProductoDto {}

export class ProductoRespuestaDto {
  @ApiProperty({ type: String, example: '1' }) id!: string;
  itemcode!: string;
  itemname!: string;
  iva!: number;
  itmsgrpcode!: number;
  @ApiProperty({ type: String, nullable: true }) itmsgrpnam!: string | null;
  @ApiProperty({ type: String, nullable: true }) inventory!: string | null;
  pricelist!: number;
  @ApiProperty({ type: String, nullable: true }) pricelistname!: string | null;
  @ApiProperty({ type: String, nullable: true, example: '15000.123456' })
  price!: string | null;
  @ApiProperty({ type: String, nullable: true }) tipo!: string | null;
}

export class PaginaProductoDto {
  items!: ProductoRespuestaDto[];
  total!: number;
  page!: number;
  limit!: number;
  totalPages!: number;
}

export class LoteProductosRespuestaDto {
  @ApiProperty({ type: 'integer', minimum: 1, example: 5000 })
  recibidos!: number;
  @ApiProperty({ type: 'integer', minimum: 0, example: 4800 })
  insertados!: number;
  @ApiProperty({
    type: 'integer',
    minimum: 0,
    example: 200,
    description:
      'Combinaciones únicas del envío que ya existen en la empresa, incluidas las creadas por otro envío concurrente. No se modifican.',
  })
  existentes!: number;
  @ApiProperty({
    type: 'integer',
    minimum: 0,
    example: 0,
    description:
      'Repeticiones adicionales de itemcode y pricelist dentro del arreglo. Se considera solo la primera aparición.',
  })
  duplicadosEnLote!: number;
  @ApiProperty({
    type: 'integer',
    minimum: 0,
    example: 200,
    description:
      'Total no insertado: existentes + duplicadosEnLote. recibidos = insertados + omitidos.',
  })
  omitidos!: number;
}
