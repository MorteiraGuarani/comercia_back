import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { MAX_INT4 } from '../../common/utils/numeros';
import { PaginacionDto } from '../../common/utils/paginacion';

export class ListarEquiposGestionDto extends PaginacionDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  buscar?: string;
}

export class ElegirEquipoGestionDto {
  /** null = todos sus equipos juntos. */
  @ValidateIf((_obj, value: unknown) => value !== null)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_INT4)
  equipoId!: number | null;
}
