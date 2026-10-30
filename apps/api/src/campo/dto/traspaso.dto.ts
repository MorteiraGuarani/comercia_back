import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { MAX_INT4 } from '../../common/utils/numeros';

/** Locales de un titular: todos (menos los excluidos) o una lista puntual. */
export class SeleccionLocalesDto {
  @IsOptional() @IsBoolean() todos?: boolean;

  @IsArray()
  @ArrayMaxSize(500)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  excluir: string[] = [];

  @IsArray()
  @ArrayMaxSize(500)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  locales: string[] = [];
}

/** Pasa locales de origen a destino desde una fecha; con intercambio, también al revés. */
export class TraspasoAsignacionesDto {
  @IsInt() @Min(1) @Max(MAX_INT4) origenId!: number;
  @IsInt() @Min(1) @Max(MAX_INT4) destinoId!: number;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) fecha!: string;

  @ValidateNested()
  @Type(() => SeleccionLocalesDto)
  seleccion!: SeleccionLocalesDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SeleccionLocalesDto)
  intercambio?: SeleccionLocalesDto;
}
