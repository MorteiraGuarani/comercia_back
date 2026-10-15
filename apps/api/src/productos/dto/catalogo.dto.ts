import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
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
import { esIdProducto } from '../utils/producto';

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
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  itemcode!: string;
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  itemname!: string;
  @IsInt() @Min(MIN_INT2) @Max(MAX_INT2) iva!: number;
  @IsInt() @Min(MIN_INT4) @Max(MAX_INT4) itmsgrpcode!: number;
  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  itmsgrpnam?: string | null;
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    default: 'Y',
    maxLength: 1,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1)
  inventory?: string | null;
  @IsInt() @Min(MIN_INT2) @Max(MAX_INT2) pricelist!: number;
  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  pricelistname?: string | null;
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '15000.123456',
    description: 'NUMERIC(21,6) como texto: hasta 15 enteros y 6 decimales.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^-?(?:0|[1-9]\d{0,14})(?:\.\d{1,6})?$/)
  price?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 50 })
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
