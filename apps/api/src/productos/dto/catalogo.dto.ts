import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PaginacionDto } from '../../common/utils/paginacion';
import { MAX_INT4 } from '../../common/utils/numeros';

export class ConsultaCatalogoDto extends PaginacionDto {
  @IsOptional() @IsString() @MaxLength(200) buscar?: string;
  @IsOptional() @IsString() @MaxLength(50) cardCode?: string;
}

export class EmpresaCatalogoParams {
  @Type(() => Number) @IsInt() @Min(1) @Max(MAX_INT4) empresaId!: number;
}

export class ProductoCatalogoParams extends EmpresaCatalogoParams {
  @IsString() @MinLength(1) @MaxLength(50) cardCode!: string;
}

export class PrecioCatalogoParams extends EmpresaCatalogoParams {
  @Type(() => Number) @IsInt() @Min(1) @Max(MAX_INT4) id!: number;
}

export class DatosProductoDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  descripcion!: string;
  @IsInt() @Min(0) @Max(100) iva!: number;
  @IsInt() @Min(0) @Max(MAX_INT4) grupo!: number;
  @IsString() @MaxLength(200) nombreGrupo!: string;
  @IsBoolean() inventario!: boolean;
  @IsString() @MaxLength(100) tipo!: string;
}

export class CrearProductoDto extends DatosProductoDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  cardCode!: string;
}

export class PrecioCatalogoDto {
  @IsString() @MinLength(1) @MaxLength(50) cardCode!: string;
  @IsInt() @Min(0) @Max(MAX_INT4) nroListaPrecio!: number;
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  listaPrecio!: string;
  // Viaja como texto para conservar los 21 digitos sin redondeo de JavaScript.
  @IsString()
  @Matches(/^(?:0|[1-9]\d{0,14})(?:\.\d{1,6})?$/)
  precio!: string;
}
