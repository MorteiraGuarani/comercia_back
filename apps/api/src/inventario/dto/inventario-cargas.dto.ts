import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginacionDto } from '../../common/utils/paginacion';
import { ESTADOS_CARGA, type EstadoCarga } from '../utils/estado-carga';

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const MENSAJE_FECHA = 'La fecha debe tener el formato AAAA-MM-DD';

export class OpcionesCargasInventarioDto extends PaginacionDto {
  @IsOptional() @IsString() @MaxLength(120) buscar?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) equipoId?: number;

  /** Solo la usa el superadmin; para el resto manda su propia empresa. */
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) empresaId?: number;
}

export class ConsultaCargasInventarioDto extends OpcionesCargasInventarioDto {
  /** Sin fechas, el día de hoy. */
  @IsOptional() @Matches(FECHA, { message: MENSAJE_FECHA }) desde?: string;

  @IsOptional() @Matches(FECHA, { message: MENSAJE_FECHA }) hasta?: string;

  @IsOptional() @IsIn(ESTADOS_CARGA) estado?: EstadoCarga;

  /** Esa persona y toda su cadena hacia abajo. */
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) responsableId?: number;
}
