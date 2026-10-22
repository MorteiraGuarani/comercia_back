import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginacionDto } from '../../common/utils/paginacion';

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export class BuscarInventarioDto extends PaginacionDto {
  @IsOptional() @IsString() @MaxLength(120) buscar?: string;
}

export class ConsultaInventarioLocalDto extends PaginacionDto {
  /** Día a consultar (YYYY-MM-DD); por defecto, hoy. Solo hoy se edita. */
  @IsOptional()
  @Matches(FECHA, { message: 'La fecha debe tener el formato AAAA-MM-DD' })
  fecha?: string;
}

export class AgregarProductosInventarioDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsString({ each: true })
  @Length(1, 15, { each: true })
  itemcodes!: string[];
}

export class CargaInventarioDto {
  @IsString() @Length(1, 15) itemcode!: string;

  @Type(() => Number)
  @IsInt({ message: 'La cantidad debe ser un número entero' })
  @Min(0)
  @Max(1_000_000)
  cantidad!: number;

  @Matches(FECHA, {
    message: 'El vencimiento debe tener el formato AAAA-MM-DD',
  })
  vencimiento!: string;
}

export class GuardarCargasInventarioDto {
  /** Día de la carga hecha sin conexión (YYYY-MM-DD); por defecto, hoy. */
  @IsOptional()
  @Matches(FECHA, { message: 'La fecha debe tener el formato AAAA-MM-DD' })
  fecha?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CargaInventarioDto)
  cargas!: CargaInventarioDto[];
}

export class ConfiguracionInventarioDto {
  /** Días antes del vencimiento en que se avisa. */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  diasAviso!: number;
}
